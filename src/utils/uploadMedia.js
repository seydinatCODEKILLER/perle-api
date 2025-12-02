import cloudinary from "../config/cloudinary.js";

export default class MediaUploader {
  constructor() {
    this.uploadResults = new Map();
  }

  async upload(file, folder = "hackathon/media", prefix = "file") {
    if (!file || typeof file !== "object") return null;

    try {
      const base64 = file.buffer.toString("base64");
      const dataUri = `data:${file.mimetype};base64,${base64}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder,
        public_id: `${prefix}_${Date.now()}`,
        resource_type: "auto",
      });

      this.uploadResults.set(prefix, {
        public_id: result.public_id,
        url: result.secure_url,
      });

      return result.secure_url;
    } catch (error) {
      console.error("Upload failed:", error);
      throw error;
    }
  }

  async rollback(prefix) {
    const uploadInfo = this.uploadResults.get(prefix);
    if (!uploadInfo) return;

    try {
      await cloudinary.uploader.destroy(uploadInfo.public_id, { resource_type: "auto" });
      this.uploadResults.delete(prefix);
      console.log(`Rollback successful - deleted: ${uploadInfo.public_id}`);
    } catch (error) {
      console.error("Rollback failed:", error);
    }
  }

  async deleteByUrl(url) {
    if (!url) return;

    try {
      const publicId = url.match(/hackathon\/media\/[^\/]+(?=\.|$)/)?.[0];
      if (publicId) {
        await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
        console.log(`Deleted media: ${publicId}`);
      }
    } catch (error) {
      console.error("Delete by URL failed:", error);
    }
  }
}
