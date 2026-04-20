import { z } from "zod"

const envSchema = z.object({
  SRC_DIR: z.string().min(1),
  OUTPUT_DIR: z.string().min(1),
  PACKAGES_DIR: z.string().min(1),
  LDAP_API_URL: z.string().url(),
  RIGHTS_SECRET: z.string().min(32),
})

export const env = envSchema.parse({
  SRC_DIR: process.env.SRC_DIR,
  OUTPUT_DIR: process.env.OUTPUT_DIR,
  PACKAGES_DIR: process.env.PACKAGES_DIR,
  LDAP_API_URL: process.env.LDAP_API_URL,
  RIGHTS_SECRET: process.env.RIGHTS_SECRET,
})
