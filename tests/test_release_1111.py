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


class PublicBookingEntitlementTests(TestCase):
    def test_public_detail_fails_closed_until_entitlement_is_confirmed(self) -> None:
        api = (ROOT / "js/api.js").read_text(encoding="utf-8")
        detail = api.split("async function bhObterEstabelecimento", 1)[1].split(
            "async function bhObterMeuEstabelecimento", 1
        )[0]

        self.assertIn("data.aceita_agendamento = false;", detail)
        self.assertIn('typeof agendaEfetiva !== "boolean"', detail)
        self.assertIn("data.aceita_agendamento = agendaEfetiva;", detail)


class FinancialClosingMigrationTests(TestCase):
    def test_closing_adds_expense_and_result_fields_without_redefining_net_revenue(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917123000_reconciliacao_fechamento_financeiro.sql").read_text(
            encoding="utf-8"
        ).lower()

        self.assertIn("despesas_realizadas", migration)
        self.assertIn("resultado_operacional", migration)
        self.assertIn("resultado_apos_comissoes", migration)
        self.assertIn("l.tipo = 'despesa'", migration)
        self.assertIn("v_bruta + v_creditos - v_debitos, v_despesas", migration)

    def test_closing_verifier_requires_the_new_contract(self) -> None:
        verifier = (ROOT / "sql/verificar_35_reconciliacao_fechamento_financeiro.sql").read_text(encoding="utf-8").lower()

        self.assertIn("colunas_de_reconciliacao_ok", verifier)
        self.assertIn("fechamento_inclui_despesas_e_comissoes_ok", verifier)
