import { mkdir, readFile, writeFile, stat } from 'fs/promises'
import { dirname } from 'path'
import pino from 'pino'
import * as z from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
})

const NetworkSchema = z.object({
  rpcUrl: z.string().url().default('https://ethereum.api.example.com'),
})

const ContractAddressesSchema = z.object({
  token: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0x0000000000000000000000000000000000000000'),
  pair: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0x0000000000000000000000000000000000000000'),
  router: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0x0000000000000000000000000000000000000000'),
})

const PrivateKeysSchema = z.object({
  baseWallet: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .default(
      '0x0000000000000000000000000000000000000000000000000000000000000000'
    ),
})

const ApplicationSchema = z.object({
  privateKeyFile: z.string().default('./.projects/dir/pks.json'),
})

const ContractsSchema = z.object({
  contractAddresses: ContractAddressesSchema,
  privateKeys: PrivateKeysSchema,
  application: ApplicationSchema,
})

const ConfigSchema = z.object({
  network: NetworkSchema,
  contracts: ContractsSchema,
})

type Config = z.infer<typeof ConfigSchema>

async function writeDefaultConfig(filePath: string): Promise<void> {
  const configContent = {
    $schema: './config.schema.json',
    network: {
      rpcUrl: 'https://ethereum.api.example.com',
    },
    contracts: {
      contractAddresses: {
        token: '0x0000000000000000000000000000000000000000',
        pair: '0x0000000000000000000000000000000000000000',
        router: '0x0000000000000000000000000000000000000000',
      },
      privateKeys: {
        baseWallet:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
      application: {
        privateKeyFile: './.projects/dir/pks.json',
      },
    },
  }
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(configContent, null, 2))
  logger.info(`Default config written to ${filePath}`)
}

async function validateConfigFile(filePath: string): Promise<Config> {
  const configContent = await readFile(filePath, 'utf-8')
  const config = JSON.parse(configContent)
  return ConfigSchema.parse(config)
}

async function exportSchemaToFile(schema: z.ZodSchema<any>, filePath: string) {
  try {
    const schemaJson = zodToJsonSchema(schema)
    logger.info(`Attempting to write schema to ${filePath}`)

    // Ensure the directory exists
    await mkdir(dirname(filePath), { recursive: true })

    await writeFile(filePath, JSON.stringify(schemaJson, null, 2))
    logger.info(`Successfully wrote schema to ${filePath}`)

    // Verify file was written
    const fileStats = await stat(filePath)
    logger.info(`File size: ${fileStats.size} bytes`)
  } catch (error) {
    logger.error(`Failed to export schema: ${error}`)
    throw error
  }
}

async function main() {
  try {
    // Export all schemas to JSON schema files
    await exportSchemaToFile(ConfigSchema, './config.schema.json')

    // Write default config
    const configPath = './config.json'
    await writeDefaultConfig(configPath)

    // Validate the config file
    const validatedConfig = await validateConfigFile(configPath)
    logger.info(validatedConfig, 'Validated config')
  } catch (err) {
    logger.error(err, 'An error occurred during configuration setup')
    process.exit(1)
  }
}

main()
