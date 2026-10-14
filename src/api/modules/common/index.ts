import appUrl from "../../endpoints";
import apiService from "../../apiService";
import { logger } from "../../../utils/logger";
import type {
  ApiResponseType,
  UploadUrlReqType,
  UploadUrlResType,
} from "../../../types/reqResType";

export class CommonService {
  static async getUploadUrl(
    data: UploadUrlReqType
  ): Promise<ApiResponseType<UploadUrlResType>> {
    try {
      const url = `${appUrl.common}/get-upload-url/`;
      const response: ApiResponseType<UploadUrlResType> =
        await apiService.getPostApiResponse(url, data);
      return response;
    } catch (error) {
      logger.error("This is error while getting states", error);
      throw error;
    }
  }

  static async uploadToS3WithProgress(
    uploadUrl: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);

        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };

        // Handle success
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed with status ${xhr.status}`));
          }
        };

        // Handle errors
        xhr.onerror = () => reject(new Error("S3 upload failed"));

        // Set headers and send file
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      } catch (error) {
        reject(error);
      }
    });
  }

  static async uploadToS3(uploadUrl: string, file: File): Promise<void> {
    try {
      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });
      if (!response.ok) {
        throw new Error("S3 upload failed");
      }
    } catch (error) {
      logger.error("Error uploading to S3", error);
      throw error;
    }
  }

}
