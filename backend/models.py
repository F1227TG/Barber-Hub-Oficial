"""Legacy import facade. Add new models to backend/schemas/<domain>.py."""

from backend.schemas.account import DeleteAccountRequest
from backend.schemas.appointments import AppointmentCreate, AppointmentStatusUpdate, AppointmentCancelRequest, AppointmentReschedule, AppointmentConfirmation
from backend.schemas.schedule import WalkInCreate, ScheduleBlockCreate, OpeningPeriodInput, OpeningPeriodsReplace, ManualServiceCreate
from backend.schemas.crm import CRMClientUpdate, CRMNoteCreate
from backend.schemas.finance import FinancialAdjustmentCreate, CommissionRuleCreate, CommissionRuleUpdate, DayClosingCreate, ExpenseCreate
from backend.schemas.team import TeamMemberLink, TeamMemberUpdate, TeamPermissionsUpdate
from backend.schemas.retention import WaitlistCreate, WaitlistUpdate, RecurrenceCreate, RecurrenceUpdate, LoyaltyProgramUpsert, LoyaltyRewardCreate, LoyaltyRewardUpdate, LoyaltyRedeem, CouponCreate, CouponUpdate, CampaignCreate
from backend.schemas.growth import GoalCreate, GoalUpdate, OpportunityUpdate
from backend.schemas.establishments import EstablishmentUpdate, EstablishmentStatusUpdate, ServiceCreate, ServiceUpdate, EstablishmentLocationUpdate
from backend.schemas.professionals import ProfessionalCreate, ProfessionalUpdate
from backend.schemas.admin import AdminSubscriptionUpdate, PasswordRecoveryRequest
from backend.schemas.marketplace import PromotionCreate, PromotionUpdate
from backend.schemas.support import SupportTicketCreate
from backend.schemas.imports import ImportPreviewRequest, ImportCommitRequest
from backend.schemas.notifications import PushSubscriptionCreate, PushUnsubscribeRequest, PushPreferencesUpdate
from backend.schemas.flags import FeatureFlagEvaluationRequest
