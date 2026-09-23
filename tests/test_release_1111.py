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


class FreeOnlineScheduleAndCommercialStateTests(TestCase):
    def test_free_plan_gets_basic_schedule_without_unlocking_advanced_schedule(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917153000_agenda_gratuita_planos_em_desenvolvimento.sql").read_text(
            encoding="utf-8"
        ).lower()

        self.assertIn("estado_comercial = 'desenvolvimento'", migration)
        self.assertIn("when slug = 'gratuito' then true", migration)
        self.assertIn("agenda online básica", migration)
        self.assertNotIn("permite_agenda_avancada = true", migration)

    def test_appointment_guard_respects_the_barbers_switch(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917153000_agenda_gratuita_planos_em_desenvolvimento.sql").read_text(
            encoding="utf-8"
        ).lower()

        self.assertIn("v_est.aceita_agendamento", migration)
        self.assertIn("não está aceitando agendamentos online", migration)
        self.assertIn("validar_estabelecimento_agenda_plano_1112", migration)

    def test_public_copy_hides_unvalidated_prices_and_explains_free_schedule(self) -> None:
        plans = (ROOT / "html/planos.html").read_text(encoding="utf-8").lower()

        self.assertGreaterEqual(plans.count("em desenvolvimento"), 5)
        self.assertIn("agenda online gratuita", plans)
        self.assertIn("preço após homologação", plans)
        self.assertNotIn("r$ 49", plans)
        self.assertNotIn("r$ 89", plans)
        self.assertNotIn("r$ 129", plans)


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


class FinancialIdempotencyMigrationTests(TestCase):
    def test_adjustments_and_closings_use_separate_idempotent_rpcs(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917130000_idempotencia_ajustes_fechamentos.sql").read_text(
            encoding="utf-8"
        ).lower()

        self.assertIn("operacoes_financeiras_idempotentes", migration)
        self.assertIn("criar_ajuste_financeiro_idempotente_1111", migration)
        self.assertIn("fechar_dia_financeiro_idempotente_1111", migration)
        self.assertIn("a chave de idempotência já foi usada com dados diferentes", migration)
        self.assertIn("revoke all on function public.criar_ajuste_financeiro_19", migration)

    def test_frontend_reuses_the_form_key_for_financial_retries(self) -> None:
        operation = (ROOT / "js/features/professional-operation.js").read_text(encoding="utf-8")
        api = (ROOT / "js/backend-api.js").read_text(encoding="utf-8")

        self.assertIn("form.dataset.idempotencyKey ||= `finance-adjustment:${crypto.randomUUID()}`", operation)
        self.assertIn("form.dataset.idempotencyKey ||= `finance-closing:${crypto.randomUUID()}`", operation)
        self.assertIn("createFinancialAdjustment", api)
        self.assertIn("idempotencyKey: data?.chave_idempotencia || null", api)


class OperationalComposerRegressionTests(TestCase):
    def test_finance_expense_uses_the_visible_finance_composer(self) -> None:
        operation = (ROOT / "js/features/operation-real-1.10.js").read_text(encoding="utf-8")

        self.assertIn('function composerHost(kind, trigger = null)', operation)
        self.assertIn('kind === "expense" && trigger?.closest("#secFinanceiro")', operation)
        self.assertIn('return $("#financeComposer19")', operation)
        self.assertIn('openComposer(target.dataset.operation110, target)', operation)

    def test_professional_shortcuts_can_shrink_inside_the_dashboard(self) -> None:
        styles = (ROOT / "css/releases/release-1.11.css").read_text(encoding="utf-8")

        self.assertIn('.page-painel .professional-command-center > * { min-width: 0; }', styles)
        self.assertIn('.page-painel .command-actions .btn {', styles)
        self.assertIn('overflow-wrap: anywhere;', styles)


class AccountDeletionRecoveryMigrationTests(TestCase):
    def test_deletion_keeps_a_private_retry_identity_only_until_conclusion(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917133000_exclusao_conta_recuperavel.sql").read_text(
            encoding="utf-8"
        ).lower()

        self.assertIn("add column if not exists user_id_tecnico uuid", migration)
        self.assertIn("user_id,user_id_tecnico,user_hash", migration)
        self.assertIn("where s.user_id_tecnico is not null", migration)
        self.assertIn("returning s.id,s.user_id_tecnico", migration)
        self.assertIn("user_id=null,user_id_tecnico=null", migration)

    def test_deletion_cancels_future_client_and_professional_appointments_before_anonymization(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917133000_exclusao_conta_recuperavel.sql").read_text(
            encoding="utf-8"
        ).lower()

        self.assertIn("conta do cliente removida", migration)
        self.assertIn("profissional indisponivel por exclusao de conta", migration)
        self.assertIn("p.user_id=p_user", migration)
        self.assertIn("permite_email_marketing=false,data_nascimento=null", migration)

    def test_deletion_verifier_covers_retry_and_privacy_boundaries(self) -> None:
        verifier = (ROOT / "sql/verificar_37_exclusao_conta_recuperavel.sql").read_text(encoding="utf-8").lower()

        self.assertIn("exclusao_recuperavel_ok", verifier)
        self.assertIn("user_id_tecnico is not null", verifier)
        self.assertIn("user_id_tecnico=null", verifier)


class RetentionSimulationMigrationTests(TestCase):
    def test_retention_cron_is_fail_closed_and_only_simulates(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917140000_retencao_simulacao_controlada.sql").read_text(
            encoding="utf-8"
        ).lower()
        legacy = migration.split("create or replace function public.executar_retencao_tecnica_111()", 1)[1]

        self.assertIn("execucao_habilitada boolean not null default false", migration)
        self.assertIn("set ativa=false,execucao_habilitada=false", migration)
        self.assertIn("retencao_simulacoes_1111", migration)
        self.assertIn("'modo','simulacao'", migration)
        self.assertIn("'acoes_aplicadas',0", migration)
        self.assertIn("simular_retencao_tecnica_1111('cron')", legacy)
        self.assertNotIn("delete from public.", legacy)

    def test_retention_verifier_and_inventory_document_the_approval_boundary(self) -> None:
        verifier = (ROOT / "sql/verificar_38_retencao_simulacao_controlada.sql").read_text(encoding="utf-8").lower()
        inventory = (ROOT / "docs/release-1.11/RETENCAO_SIMULACAO_1_11_1.md").read_text(encoding="utf-8").lower()

        self.assertIn("retencao_simulacao_controlada_ok", verifier)
        self.assertIn("nenhuma categoria deve iniciar ativa", verifier)
        self.assertIn("não ativa descarte automático", inventory)
        self.assertIn("decisão necessária antes da aplicação real", inventory)


class InternalNotificationPilotTests(TestCase):
    def test_external_notification_delivery_requires_an_explicit_environment_switch(self) -> None:
        config = (ROOT / "backend/config.py").read_text(encoding="utf-8")
        push = (ROOT / "backend/services/push.py").read_text(encoding="utf-8")
        email = (ROOT / "backend/services/email_delivery.py").read_text(encoding="utf-8")
        vercel = (ROOT / "vercel.json").read_text(encoding="utf-8")

        self.assertIn("BARBER_HUB_EXTERNAL_NOTIFICATIONS_ENABLED", config)
        self.assertIn("external_notifications_enabled", push)
        self.assertIn("EXTERNAL_NOTIFICATIONS_DISABLED", push)
        self.assertIn("external_notifications_enabled", email)
        self.assertNotIn('"path": "/api/v1/jobs/push/deliver?limit=50"', vercel)


class AccountExportMigrationTests(TestCase):
    def test_export_covers_own_retention_relationships_without_exporting_secrets(self) -> None:
        migration = (ROOT / "supabase/migrations/20260917150000_exportacao_dados_conta_ampliada.sql").read_text(
            encoding="utf-8"
        ).lower()

        self.assertIn("'lista_espera'", migration)
        self.assertIn("'recorrencias'", migration)
        self.assertIn("'fidelidade_saldos'", migration)
        self.assertIn("'fidelidade_movimentos'", migration)
        self.assertIn("'notificacoes'", migration)
        self.assertIn("'dispositivos_push'", migration)
        self.assertIn("'exclusoes_justificadas'", migration)
        self.assertNotIn("to_jsonb(p) from public.push_assinaturas", migration)

    def test_export_verifier_protects_the_own_data_boundary(self) -> None:
        verifier = (ROOT / "sql/verificar_39_exportacao_dados_conta_ampliada.sql").read_text(encoding="utf-8").lower()
        documentation = (ROOT / "docs/release-1.11/EXPORTACAO_DE_DADOS_1_11_1.md").read_text(encoding="utf-8").lower()

        self.assertIn("exportacao_dados_conta_ampliada_ok", verifier)
        self.assertIn("endpoint", verifier)
        self.assertIn("não inclui crm", documentation)


class OperationalGovernanceDecisionTests(TestCase):
    def test_recovery_targets_are_defined_but_still_require_a_rehearsal(self) -> None:
        runbook = (ROOT / "docs/release-1.11/BACKUP_E_RESTAURACAO.md").read_text(encoding="utf-8").lower()

        self.assertIn("24 horas", runbook)
        self.assertIn("8 horas", runbook)
        self.assertIn("rpo observado", runbook)
        self.assertIn("rto observado", runbook)
        self.assertIn("não é evidência de capacidade", runbook)

    def test_retention_and_password_controls_remain_fail_closed_until_external_approval(self) -> None:
        retention = (ROOT / "docs/release-1.11/RETENCAO_SIMULACAO_1_11_1.md").read_text(encoding="utf-8").lower()
        external = (ROOT / "docs/release-1.11/CONFIGURACAO_EXTERNA.md").read_text(encoding="utf-8").lower()

        self.assertIn("simulação apenas", retention)
        self.assertIn("2 dias", retention)
        self.assertIn("90 dias", retention)
        self.assertIn("não fazer upgrade pago", external)
        self.assertIn("pwned passwords", external)
