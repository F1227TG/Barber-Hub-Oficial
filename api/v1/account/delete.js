/**
 * DELETE /api/v1/account/delete
 * Confirma a identidade pelo token e delega a exclusão transacional à função segura do banco.
 */

const { ApiError, createHandler, readJson, success } = require("../../../server/lib/http");
const { authenticatedUser, request } = require("../../../server/lib/supabase");

module.exports = createHandler(async (req, res) => {
  const body = await readJson(req, 4_000);
  if (String(body.confirmacao || "").trim().toUpperCase() !== "EXCLUIR") {
    throw new ApiError(422, "CONFIRMATION_REQUIRED", "Digite EXCLUIR para confirmar a operação.");
  }

  const { token, user } = await authenticatedUser(req, true);
  await request("/rest/v1/rpc/excluir_minha_conta", {
    method: "POST",
    token,
    body: {}
  });

  success(res, {
    deleted: true,
    userId: user.id
  });
}, ["DELETE"]);
