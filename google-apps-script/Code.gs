const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
];
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function doPost(event) {
  try {
    const request = JSON.parse(event.postData.contents);
    const expectedKey = PropertiesService.getScriptProperties().getProperty("API_KEY");
    if (!expectedKey || request.apiKey !== expectedKey) {
      return jsonOutput({ ok: false, error: "API key tidak valid." });
    }

    if (!USER_ID_PATTERN.test(request.userId || "")) {
      return jsonOutput({ ok: false, error: "User tidak valid." });
    }

    if (request.action === "upload") {
      return jsonOutput(uploadFile(request));
    }
    if (request.action === "delete") {
      return jsonOutput(deleteFile(request));
    }
    return jsonOutput({ ok: false, error: "Action tidak didukung." });
  } catch (error) {
    console.error(error);
    return jsonOutput({ ok: false, error: error.message || "Terjadi kesalahan." });
  }
}

function uploadFile(request) {
  if (!USER_ID_PATTERN.test(request.todoId || "")) {
    return { ok: false, error: "Todo tidak valid." };
  }
  if (!ALLOWED_MEDIA_TYPES.includes(request.mimeType)) {
    return { ok: false, error: "Format media tidak didukung." };
  }
  if (typeof request.base64 !== "string") {
    return { ok: false, error: "Konten file tidak valid." };
  }

  const bytes = Utilities.base64Decode(request.base64);
  if (!bytes.length || bytes.length > MAX_FILE_SIZE) {
    return { ok: false, error: "Ukuran file harus maksimal 20 MB." };
  }

  const folder = getUserFolder(request.userId);
  const cleanName = String(request.fileName || "todo-media")
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .slice(0, 180);
  const blob = Utilities.newBlob(bytes, request.mimeType, cleanName);
  const file = folder.createFile(blob);
  try {
    file.setDescription(JSON.stringify({
      userId: request.userId,
      todoId: request.todoId,
    }));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    file.setTrashed(true);
    throw error;
  }

  return {
    ok: true,
    file: {
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
    },
  };
}

function deleteFile(request) {
  if (
    typeof request.fileId !== "string" ||
    !/^[a-zA-Z0-9_-]{10,200}$/.test(request.fileId)
  ) {
    return { ok: false, error: "ID file tidak valid." };
  }

  const file = DriveApp.getFileById(request.fileId);
  let metadata;
  try {
    metadata = JSON.parse(file.getDescription() || "{}");
  } catch (error) {
    return { ok: false, error: "File tidak dikelola oleh aplikasi ini." };
  }
  if (metadata.userId !== request.userId) {
    return { ok: false, error: "Akses ke file ditolak." };
  }

  file.setTrashed(true);
  return { ok: true, fileId: request.fileId };
}

function getUserFolder(userId) {
  const properties = PropertiesService.getScriptProperties();
  const rootId = properties.getProperty("MEDIA_FOLDER_ID");
  const root = rootId
    ? DriveApp.getFolderById(rootId)
    : DriveApp.createFolder("Rapi Todo Media");
  if (!rootId) properties.setProperty("MEDIA_FOLDER_ID", root.getId());

  const folders = root.getFoldersByName(userId);
  return folders.hasNext() ? folders.next() : root.createFolder(userId);
}

function jsonOutput(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
