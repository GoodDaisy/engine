import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";

import { Static, Type } from "@sinclair/typebox";
import { getContract } from "../../../../../../utils/cache/getContract";
import {
  erc1155ContractParamSchema,
  standardResponseSchema,
} from "../../../../../schemas/sharedApiSchemas";
import { getChainIdFromChain } from "../../../../../utils/chain";

// INPUTS
const requestSchema = erc1155ContractParamSchema;
const querystringSchema = Type.Object({
  ownerWallet: Type.String({
    description: "Address of the wallet who owns the NFT",
    examples: ["0x3EcDBF3B911d0e9052b64850693888b008e18373"],
  }),
  operator: Type.String({
    description: "Address of the operator to check approval on",
    examples: ["0x1946267d81Fb8aDeeEa28e6B98bcD446c8248473"],
  }),
});

// OUTPUT
const responseSchema = Type.Object({
  result: Type.Optional(Type.Boolean()),
});

responseSchema.examples = [
  {
    result: true,
  },
];

// LOGIC
export async function erc1155IsApproved(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Querystring: Static<typeof querystringSchema>;
  }>({
    method: "GET",
    url: "/contract/:chain/:contractAddress/erc1155/is-approved",
    schema: {
      summary: "Check if approved transfers",
      description:
        "Check if the specific wallet has approved transfers from a specific operator wallet.",
      tags: ["ERC1155"],
      operationId: "isApproved",
      params: requestSchema,
      querystring: querystringSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain, contractAddress } = request.params;
      const { ownerWallet, operator } = request.query;
      const chainId = getChainIdFromChain(chain);
      const contract = await getContract({
        chainId,
        contractAddress,
      });
      const returnData: any = await contract.erc1155.isApproved(
        ownerWallet,
        operator,
      );

      reply.status(StatusCodes.OK).send({
        result: returnData,
      });
    },
  });
}
