import { z } from "zod";

export const filePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((path) => !path.startsWith("/") && !path.split("/").includes(".."), {
    message: "Invalid file path",
  });

export const downloadSigningQuery = z.object({ filePath: filePathSchema });

export const signedQuery = z.object({
  filePath: filePathSchema,
  expires: z.coerce.number().int().positive(),
  signature: z.string().min(1),
});

export type SignedQuery = z.infer<typeof signedQuery>;

export const uploadBody = z.object({ file: z.instanceof(File) });
