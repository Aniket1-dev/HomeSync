// Shared avatar upload widget — Supabase Storage-backed.
// Requires a public "avatars" bucket + policies from sql/schema.sql (MIGRATION 3).
//
// initAvatarPicker(opts) wires up a file input + preview circle + hidden
// state, and calls onUploaded(publicUrl) once the file is stored.

function initAvatarPicker({ fileInputId, previewElId, userId, existingUrl, onUploaded, onError }) {
  const fileInput = document.getElementById(fileInputId);
  const preview = document.getElementById(previewElId);
  if (!fileInput || !preview) return;

  if (existingUrl) {
    preview.style.backgroundImage = `url(${existingUrl})`;
    preview.textContent = "";
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError?.("Please choose an image file.");
      fileInput.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError?.("Image must be under 5MB.");
      fileInput.value = "";
      return;
    }

    // Instant local preview while the upload runs
    const localUrl = URL.createObjectURL(file);
    preview.style.backgroundImage = `url(${localUrl})`;
    preview.textContent = "";

    try {
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient.storage.from("avatars").getPublicUrl(path);
      onUploaded?.(publicData.publicUrl);
    } catch (err) {
      onError?.(err.message || "Upload failed. Try a different image.");
      if (existingUrl) {
        preview.style.backgroundImage = `url(${existingUrl})`;
      } else {
        preview.style.backgroundImage = "";
      }
    }
  });
}
