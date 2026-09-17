"""Regression contracts for the 1.11.1 corrective migrations."""

from pathlib import Path
from unittest import TestCase


ROOT = Path(__file__).resolve().parents[1]


class PublicShowcaseRlsMigrationTests(TestCase):
    def test_public_schedule_policy_never_calls_private_operator_helper(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917120000_correcao_rls_vitrine_publica.sql").read_text(
            encoding="utf-8"
        ).lower()
        public_policy = migration.split("create policy horario_periodos_select_publico_1111", 1)[1].split(
            "create policy horario_periodos_select_operacional_1111", 1
        )[0]

        self.assertIn("to anon, authenticated", public_policy)
        self.assertIn("e.visivel", public_policy)
        self.assertIn("e.onboarding_concluido", public_policy)
        self.assertIn("not e.suspenso_pela_moderacao", public_policy)
        self.assertNotIn("pode_operar_estabelecimento_19", public_policy)

    def test_operational_schedule_policy_is_authenticated_only(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917120000_correcao_rls_vitrine_publica.sql").read_text(
            encoding="utf-8"
        ).lower()
        operational_policy = migration.split("create policy horario_periodos_select_operacional_1111", 1)[1]

        self.assertIn("to authenticated", operational_policy)
        self.assertIn("private.pode_operar_estabelecimento_19(estabelecimento_id)", operational_policy)

    def test_database_verifier_covers_both_policy_boundaries(self) -> None:
        verifier = (ROOT / "sql/verificar_34_correcao_rls_vitrine_publica.sql").read_text(encoding="utf-8").lower()

        self.assertIn("politica_publica_segura_ok", verifier)
        self.assertIn("politica_operacional_isolada_ok", verifier)
        self.assertIn("anon_sem_acesso_ao_schema_privado_ok", verifier)
