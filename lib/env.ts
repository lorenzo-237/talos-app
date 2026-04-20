import { z } from "zod"

export type Environment = "prod" | "test" | "dev"

const envSchema = z.object({
  SRC_DIR: z.string().min(1),
  OUTPUT_DIR_PROD: z.string().min(1),
  OUTPUT_DIR_TEST: z.string().min(1),
  OUTPUT_DIR_DEV: z.string().min(1),
  PACKAGES_DIR: z.string().min(1),
  LDAP_API_URL: z.string().url(),
  RIGHTS_SECRET: z.string().min(32),
})

export const env = envSchema.parse({
  SRC_DIR: process.env.SRC_DIR,
  OUTPUT_DIR_PROD: process.env.OUTPUT_DIR_PROD,
  OUTPUT_DIR_TEST: process.env.OUTPUT_DIR_TEST,
  OUTPUT_DIR_DEV: process.env.OUTPUT_DIR_DEV,
  PACKAGES_DIR: process.env.PACKAGES_DIR,
  LDAP_API_URL: process.env.LDAP_API_URL,
  RIGHTS_SECRET: process.env.RIGHTS_SECRET,
})

export function getOutputDir(environment: Environment): string {
  switch (environment) {
    case "prod":
      return env.OUTPUT_DIR_PROD
    case "test":
      return env.OUTPUT_DIR_TEST
    case "dev":
      return env.OUTPUT_DIR_DEV
  }
}
