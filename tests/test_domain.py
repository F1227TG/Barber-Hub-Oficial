"""Offline tests for pure business rules (no FastAPI, Supabase or Vercel)."""

from unittest import TestCase

from backend.domain.appointments import APPOINTMENT_TRANSITIONS, allowed_transitions, can_transition
from backend.domain.plans import normalized_limit, plan_limit_reached


class AppointmentTransitionTests(TestCase):
    def test_every_declared_transition_is_allowed(self) -> None:
        for previous, targets in APPOINTMENT_TRANSITIONS.items():
            for target in targets:
                with self.subTest(previous=previous, target=target):
                    self.assertTrue(can_transition(previous, target))

    def test_terminal_states_cannot_transition(self) -> None:
        for status in ("recusado", "concluido", "cancelado"):
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

