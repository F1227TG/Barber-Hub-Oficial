"""Offline tests for pure business rules (no FastAPI, Supabase or Vercel)."""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from unittest import TestCase

from backend.domain.appointments import APPOINTMENT_TRANSITIONS, allowed_transitions, can_transition
from backend.domain.plans import normalized_limit, plan_limit_reached
from backend.domain.crm import average_ticket, classify_client, normalize_tags
from backend.domain.finance import calculate_commission, net_revenue
from backend.domain.growth import goal_progress, occupancy_rate, opportunity_priority, retention_rate
from backend.domain.permissions import can_manage_appointment, effective_capabilities, role_can
from backend.domain.retention import coupon_discount, loyalty_points, recurrence_dates, waitlist_window_is_valid
from backend.domain.schedule import Period, appointment_period, conflicts_with_blocks, periods_overlap, schedule_range
from backend.domain.operations import (
    canonical_request_hash,
    financial_result,
    normalize_origin_channel,
    normalize_page,
    normalize_payment_method,
    validate_opening_periods,
)
from backend.domain.imports import normalize_import_rows, parse_import_file, spreadsheet_formula_risk


class AppointmentTransitionTests(TestCase):
    def test_every_declared_transition_is_allowed(self) -> None:
        for previous, targets in APPOINTMENT_TRANSITIONS.items():
            for target in targets:
                with self.subTest(previous=previous, target=target):
                    self.assertTrue(can_transition(previous, target))

    def test_terminal_states_cannot_transition(self) -> None:
        for status in ("recusado", "concluido", "cancelado", "faltou"):
            with self.subTest(status=status):
                self.assertEqual(allowed_transitions(status), frozenset())

    def test_unknown_and_same_state_transitions_are_denied(self) -> None:
        self.assertFalse(can_transition("desconhecido", "confirmado"))
        for status in APPOINTMENT_TRANSITIONS:
            with self.subTest(status=status):
                self.assertFalse(can_transition(status, status))


class PlanLimitTests(TestCase):
    def test_limit_normalization_is_safe_offline(self) -> None:
        self.assertEqual(normalized_limit(None), 1)
        self.assertEqual(normalized_limit("4"), 4)
        self.assertEqual(normalized_limit("invalido"), 1)
        self.assertEqual(normalized_limit(0), 1)

    def test_plan_limit_boundary(self) -> None:
        self.assertFalse(plan_limit_reached(2, 3))
        self.assertTrue(plan_limit_reached(3, 3))
        self.assertTrue(plan_limit_reached(4, 3))


class ScheduleRuleTests(TestCase):
    def test_day_and_week_ranges_are_inclusive(self) -> None:
        anchor = date(2026, 8, 20)
        self.assertEqual(schedule_range(anchor, "dia"), (anchor, anchor))
        self.assertEqual(schedule_range(anchor, "semana"), (date(2026, 8, 17), date(2026, 8, 23)))

    def test_touching_periods_do_not_overlap(self) -> None:
        first = appointment_period(date(2026, 8, 20), time(10), 30)
        second = appointment_period(date(2026, 8, 20), time(10, 30), 30)
        self.assertFalse(periods_overlap(first, second))

    def test_block_conflict_is_detected(self) -> None:
        appointment = appointment_period(date(2026, 8, 20), time(10), 45)
        block = Period(datetime(2026, 8, 20, 10, 30), datetime(2026, 8, 20, 11))
        self.assertTrue(conflicts_with_blocks(appointment, [block]))


class CrmRuleTests(TestCase):
    def test_client_segments_follow_return_windows(self) -> None:
        now = datetime(2026, 8, 20, 12)
        self.assertEqual(classify_client(0, None, now), "lead")
        self.assertEqual(classify_client(1, now - timedelta(days=20), now), "novo")
        self.assertEqual(classify_client(3, now - timedelta(days=20), now), "recorrente")
        self.assertEqual(classify_client(3, now - timedelta(days=60), now), "em_risco")
        self.assertEqual(classify_client(3, now - timedelta(days=100), now), "inativo")

    def test_ticket_and_tags_are_normalized(self) -> None:
        self.assertEqual(average_ticket(Decimal("100"), 3), Decimal("33.33"))
        self.assertEqual(normalize_tags([" VIP ", "vip", " Barba  semanal "]), ["vip", "barba semanal"])


class FinanceRuleTests(TestCase):
    def test_percentage_and_fixed_commissions_are_bounded(self) -> None:
        self.assertEqual(calculate_commission(Decimal("80"), "percentual", Decimal("25")), Decimal("20.00"))
        self.assertEqual(calculate_commission(Decimal("80"), "fixo", Decimal("100")), Decimal("80.00"))
        with self.assertRaises(ValueError):
            calculate_commission(Decimal("80"), "percentual", Decimal("101"))

    def test_net_revenue_includes_adjustments(self) -> None:
        self.assertEqual(net_revenue(Decimal("500"), Decimal("30"), Decimal("45.10")), Decimal("484.90"))


class TeamPermissionTests(TestCase):
    def test_reception_cannot_access_finance(self) -> None:
        self.assertTrue(role_can("recepcao", "agenda"))
        self.assertFalse(role_can("recepcao", "financeiro"))

    def test_professional_only_manages_own_appointments(self) -> None:
        self.assertTrue(can_manage_appointment("profissional", linked_professional_id="p1", appointment_professional_id="p1"))
        self.assertFalse(can_manage_appointment("profissional", linked_professional_id="p1", appointment_professional_id="p2"))

    def test_granular_overrides_only_apply_when_enabled(self) -> None:
        self.assertIn("financeiro", effective_capabilities("gerente", {"financeiro": False}, granular_enabled=False))
        self.assertNotIn("financeiro", effective_capabilities("gerente", {"financeiro": False}, granular_enabled=True))
        self.assertIn("campanhas", effective_capabilities("recepcao", {"campanhas": True}, granular_enabled=True))


class RetentionRuleTests(TestCase):
    def test_monthly_recurrence_handles_month_end(self) -> None:
        self.assertEqual(
            recurrence_dates(date(2026, 1, 31), "mensal", 4),
            [date(2026, 1, 31), date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)],
        )

    def test_coupon_and_points_are_bounded(self) -> None:
        self.assertEqual(coupon_discount(80, discount_type="percentual", discount_value=25), Decimal("20.00"))
        self.assertEqual(coupon_discount(80, discount_type="fixo", discount_value=100), Decimal("80.00"))
        self.assertEqual(coupon_discount(200, discount_type="percentual", discount_value=50, maximum_discount=30), Decimal("30.00"))
        self.assertEqual(loyalty_points(85, points_per_visit=2, currency_per_point=20), 6)

    def test_waitlist_period_has_a_safe_limit(self) -> None:
        self.assertTrue(waitlist_window_is_valid(date(2026, 8, 20), date(2026, 9, 20)))
        self.assertFalse(waitlist_window_is_valid(date(2026, 8, 20), date(2026, 9, 21)))


class GrowthRuleTests(TestCase):
    def test_percentages_are_safe_and_bounded(self) -> None:
        self.assertEqual(occupancy_rate(180, 480), Decimal("37.50"))
        self.assertEqual(retention_rate(24, 40), Decimal("60.00"))
        self.assertEqual(goal_progress(125, 100), Decimal("100.00"))
        self.assertEqual(goal_progress(1, 0), Decimal("0.00"))

    def test_opportunity_priority_combines_impact_and_urgency(self) -> None:
        self.assertEqual(opportunity_priority(5, 4), "alta")
        self.assertEqual(opportunity_priority(3, 2), "media")
        self.assertEqual(opportunity_priority(1, 1), "baixa")


class OperationReadyTests(TestCase):
    def test_multiple_opening_periods_accept_breaks_and_reject_overlap(self) -> None:
        validate_opening_periods([
            {"dia_semana": 1, "abre": time(8), "fecha": time(12), "fecha_dia_seguinte": False},
            {"dia_semana": 1, "abre": time(14), "fecha": time(0), "fecha_dia_seguinte": True},
        ])
        with self.assertRaises(ValueError):
            validate_opening_periods([
                {"dia_semana": 1, "abre": time(8), "fecha": time(12), "fecha_dia_seguinte": False},
                {"dia_semana": 1, "abre": time(11, 30), "fecha": time(14), "fecha_dia_seguinte": False},
            ])

    def test_opening_period_detects_week_rollover(self) -> None:
        with self.assertRaises(ValueError):
            validate_opening_periods([
                {"dia_semana": 6, "abre": time(23), "fecha": time(1), "fecha_dia_seguinte": True},
                {"dia_semana": 0, "abre": time(0, 30), "fecha": time(2), "fecha_dia_seguinte": False},
            ])

    def test_idempotency_hash_and_estimated_result_are_deterministic(self) -> None:
        self.assertEqual(canonical_request_hash({"b": 2, "a": 1}), canonical_request_hash({"a": 1, "b": 2}))
        self.assertEqual(financial_result("2450", "720"), Decimal("1730.00"))
        self.assertEqual(normalize_page(999, -4), (100, 0))

    def test_form_values_are_normalized_for_storage(self) -> None:
        self.assertEqual(normalize_payment_method("credito"), "cartao_credito")
        self.assertEqual(normalize_payment_method("debito"), "cartao_debito")
        self.assertEqual(normalize_payment_method("pix"), "pix")
        self.assertEqual(normalize_origin_channel("balcao"), "presencial")
        self.assertEqual(normalize_origin_channel("barber_hub"), "interno")


class ImportSafetyTests(TestCase):
    def test_csv_preview_normalizes_headers_and_rows(self) -> None:
        parsed = parse_import_file("clientes.csv", "Nome;E-mail;Telefone\nAna;ana@example.com;38999999999\n".encode())
        valid, rejected = normalize_import_rows("clientes", parsed.rows)
        self.assertEqual(len(valid), 1)
        self.assertEqual(rejected, [])
        self.assertEqual(valid[0]["dados"]["email"], "ana@example.com")

    def test_import_rejects_formulas_and_duplicates(self) -> None:
        self.assertTrue(spreadsheet_formula_risk("=HYPERLINK(1)"))
        valid, rejected = normalize_import_rows("clientes", [
            {"nome": "Ana", "email": "ana@example.com", "telefone": ""},
            {"nome": "Ana 2", "email": "ana@example.com", "telefone": ""},
            {"nome": "Risco", "email": "=cmd", "telefone": ""},
        ])
        self.assertEqual(len(valid), 1)
        self.assertEqual(len(rejected), 2)

