import { Static, Type } from "@sinclair/typebox";
import { buildJWT } from "@thirdweb-dev/auth";
import { LocalWallet } from "@thirdweb-dev/wallets";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getConfiguration } from "../../../../db/configuration/getConfiguration";
import { updateConfiguration } from "../../../../db/configuration/updateConfiguration";
import { createToken } from "../../../../db/tokens/createToken";
import { env } from "../../../../utils/env";
import { AccessTokenSchema } from "./getAll";

const BodySchema = Type.Object({
  label: Type.Optional(Type.String()),
});

const ReplySchema = Type.Object({
  result: Type.Composite([
    AccessTokenSchema,
    Type.Object({
      accessToken: Type.String(),
    }),
  ]),
});

export async function createAccessToken(fastify: FastifyInstance) {
  fastify.route<{
    Body: Static<typeof BodySchema>;
    Reply: Static<typeof ReplySchema>;
  }>({
    method: "POST",
    url: "/auth/access-tokens/create",
    schema: {
      summary: "Create a new access token",
      description: "Create a new access token",
      tags: ["Access Tokens"],
      operationId: "create",
      body: BodySchema,
      response: {
        [StatusCodes.OK]: ReplySchema,
      },
    },
    handler: async (req, res) => {
      const { label } = req.body;

      const config = await getConfiguration();
      const wallet = new LocalWallet();

      // TODO: Remove this with next breaking change
      try {
        // First try to load the wallet using the encryption password
        await wallet.import({
          encryptedJson: config.authWalletEncryptedJson,
          password: env.ENCRYPTION_PASSWORD,
        });
      } catch {
        // If that fails, try the thirdweb api secret key for backwards compatibility
        await wallet.import({
          encryptedJson: config.authWalletEncryptedJson,
          password: env.THIRDWEB_API_SECRET_KEY,
        });

        // If that works, save the wallet using the encryption password for the future
        const authWalletEncryptedJson = await wallet.export({
          strategy: "encryptedJson",
          password: env.ENCRYPTION_PASSWORD,
        });

        await updateConfiguration({
          authWalletEncryptedJson,
        });
      }

      const jwt = await buildJWT({
        wallet,
        payload: {
          iss: await wallet.getAddress(),
          sub: req.user.address,
          aud: config.authDomain,
          nbf: new Date(),
          // Set to expire in 100 years
          exp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100),
          iat: new Date(),
          ctx: req.user.session,
        },
      });

      const token = await createToken({ jwt, isAccessToken: true, label });

      res.status(200).send({
        result: {
          ...token,
          createdAt: token.createdAt.toISOString(),
          expiresAt: token.expiresAt.toISOString(),
          accessToken: jwt,
        },
      });
    },
  });
}
