import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getContract } from "../../../../../../utils/cache/getContract";
import {
  contractParamSchema,
  standardResponseSchema,
} from "../../../../../schemas/sharedApiSchemas";
import { getChainIdFromChain } from "../../../../../utils/chain";

// INPUT
const requestSchema = contractParamSchema;

// OUPUT
const responseSchema = Type.Object({
  result: Type.Optional(Type.String()),
});

responseSchema.example = [
  {
    result: "1",
  },
];

// LOGIC
export async function erc721TotalCount(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
  }>({
    method: "GET",
    url: "/contract/:chain/:contractAddress/erc721/total-count",
    schema: {
      summary: "Get total supply",
      description:
        "Get the total supply in circulation for this ERC-721 contract.",
      tags: ["ERC721"],
      operationId: "totalCount",
      params: requestSchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain, contractAddress } = request.params;
      const chainId = getChainIdFromChain(chain);
      const contract = await getContract({
        chainId,
        contractAddress,
      });
      const returnData = await contract.erc721.totalCount();
      reply.status(StatusCodes.OK).send({
        result: returnData.toString(),
      });
    },
  });
}
