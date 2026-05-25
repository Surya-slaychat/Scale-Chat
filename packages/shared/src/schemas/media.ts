import { z } from 'zod';

/**
 * Wire shape for the `POST /media/upload-url` endpoint.
 *
 * The flow:
 *   1. Client calls this endpoint with the kind + content-type + byte size it
 *      intends to upload.
 *   2. Server validates the content-type / size against the per-kind allowlist
 *      and issues a presigned PUT URL to Cloudflare R2 with a 5-minute TTL.
 *   3. Client `PUT`s the raw bytes directly to the URL (no multipart).
 *   4. Client then sends a `message:send` (or `POST /chats/:id/messages`) with
 *      the returned `objectKey` as `mediaObjectKey`. The server re-validates the
 *      key matches the per-user prefix before persisting.
 *
 * The API never touches media bytes — saves CPU and scales R2 independently.
 */

export const MediaUploadKindEnum = z.enum(['IMAGE', 'VOICE', 'DOCUMENT', 'VIDEO']);
export type MediaUploadKind = z.infer<typeof MediaUploadKindEnum>;

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VOICE_CONTENT_TYPES = ['audio/mp4', 'audio/aac', 'audio/m4a'] as const;
export const DOCUMENT_CONTENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'application/zip',
] as const;
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];
export type VoiceContentType = (typeof VOICE_CONTENT_TYPES)[number];

/** Hard caps enforced both client- and server-side. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; //  10 MB
export const VOICE_MAX_BYTES = 5 * 1024 * 1024; //    5 MB
export const DOCUMENT_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const VIDEO_MAX_BYTES = 80 * 1024 * 1024; //   80 MB

/** Per-kind allowlist + cap, indexed by `MediaUploadKind`. */
const MEDIA_RULES: Record<MediaUploadKind, { contentTypes: readonly string[]; maxBytes: number }> = {
  IMAGE: { contentTypes: IMAGE_CONTENT_TYPES, maxBytes: IMAGE_MAX_BYTES },
  VOICE: { contentTypes: VOICE_CONTENT_TYPES, maxBytes: VOICE_MAX_BYTES },
  DOCUMENT: { contentTypes: DOCUMENT_CONTENT_TYPES, maxBytes: DOCUMENT_MAX_BYTES },
  VIDEO: { contentTypes: VIDEO_CONTENT_TYPES, maxBytes: VIDEO_MAX_BYTES },
};

export const MediaUploadRequestSchema = z
  .object({
    kind: MediaUploadKindEnum,
    contentType: z.string().min(1).max(64),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((v, ctx) => {
    const rule = MEDIA_RULES[v.kind];
    if (!rule.contentTypes.includes(v.contentType)) {
      ctx.addIssue({
        code: 'custom',
        message: `contentType must be one of: ${rule.contentTypes.join(', ')}`,
        path: ['contentType'],
      });
    }
    if (v.sizeBytes > rule.maxBytes) {
      ctx.addIssue({
        code: 'custom',
        message: `${v.kind} exceeds max size (${rule.maxBytes} bytes)`,
        path: ['sizeBytes'],
      });
    }
  });
export type MediaUploadRequest = z.infer<typeof MediaUploadRequestSchema>;

export const MediaUploadResponseSchema = z.object({
  objectKey: z.string().min(1).max(256),
  uploadUrl: z.string().url(),
  publicUrl: z.string().url(),
  contentType: z.string().min(1).max(64),
  expiresAt: z.string().datetime(),
});
export type MediaUploadResponse = z.infer<typeof MediaUploadResponseSchema>;
