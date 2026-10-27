import {
  callDriveScript,
  getAuthenticatedUser,
  jsonResponse,
} from "../../../../lib/media-server";

export const runtime = "nodejs";

const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;

export async function DELETE(request, { params }) {
  const auth = await getAuthenticatedUser(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const { fileId } = await params;
  if (!DRIVE_FILE_ID_PATTERN.test(fileId)) {
    return jsonResponse({ error: "ID file Drive tidak valid." }, 400);
  }

  const { result, error, status } = await callDriveScript({
    action: "delete",
    userId: auth.user.id,
    fileId,
  });
  if (error) return jsonResponse({ error }, status);
  return jsonResponse({ ok: true, fileId: result.fileId });
}
