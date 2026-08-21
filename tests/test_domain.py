"""Offline tests for pure business rules (no FastAPI, Supabase or Vercel)."""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from unittest import TestCase

from backend.domain.appointments import APPOINTMENT_TRANSITIONS, allowed_transitions, can_transition
from backend.domain.plans import normalized_limit, plan_limit_reached
from backend.domain.crm import average_ticket, classify_client, normalize_tags
from backend.domain.finance import calculate_commission, net_revenue
from backend.domain.permissions import can_manage_appointment, role_can
from backend.domain.schedule import Period, appointment_period, conflicts_with_blocks, periods_overlap, schedule_range


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

