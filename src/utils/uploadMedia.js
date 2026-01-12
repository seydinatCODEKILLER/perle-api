import cloudinary from "../config/cloudinary.js";

export default class MediaUploader {
  constructor() {
    this.uploadResults = new Map();
  }

async upload(file, folder = "hackathon/media", prefix = "file") {
  if (!file || !file.buffer) return null;

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: `${prefix}_${Date.now()}`,
          resource_type: "auto",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(file.buffer);
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
