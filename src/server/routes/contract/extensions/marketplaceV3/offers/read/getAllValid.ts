import { Static, Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import { StatusCodes } from "http-status-codes";
import { getContract } from "../../../../../../../utils/cache/getContract";
import { OfferV3OutputSchema } from "../../../../../../schemas/marketplaceV3/offer";
import {
  marketplaceFilterSchema,
  marketplaceV3ContractParamSchema,
  standardResponseSchema,
} from "../../../../../../schemas/sharedApiSchemas";
import { getChainIdFromChain } from "../../../../../../utils/chain";
import { formatOffersV3Result } from "../../../../../../utils/marketplaceV3";

// INPUT
const requestSchema = marketplaceV3ContractParamSchema;
const requestQuerySchema = Type.Omit(marketplaceFilterSchema, ["seller"]);

// OUPUT
const responseSchema = Type.Object({
  result: Type.Array(OfferV3OutputSchema),
});

responseSchema.examples = [
  {
    result: [
      {
        assetContractAddress: "0x19411143085F1ec7D21a7cc07000CBA5188C5e8e",
        tokenId: "0",
        currencyContractAddress: "0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889",
        quantity: "1",
        id: "0",
        offerorAddress: "0x1946267d81Fb8aDeeEa28e6B98bcD446c8248473",
        currencyValue: {
          name: "Wrapped Matic",
          symbol: "WMATIC",
          decimals: 18,
          value: "10000000000",
          displayValue: "0.00000001",
        },
        totalPrice: "10000000000",
        asset: {
          id: "0",
          uri: "ipfs://QmPw2Dd1dnB6dQCnqGayCTnxUxHrB7m4YFeyph6PYPMboP/0",
          name: "TJ-Origin",
          description: "Origin",
          external_url: "",
          attributes: [
            {
              trait_type: "Mode",
              value: "GOD",
            },
          ],
        },
        endTimeInSeconds: 1686610889,
        status: 4,
      },
    ],
  },
];

// LOGIC
export async function offersGetAllValid(fastify: FastifyInstance) {
  fastify.route<{
    Params: Static<typeof requestSchema>;
    Reply: Static<typeof responseSchema>;
    Querystring: Static<typeof requestQuerySchema>;
  }>({
    method: "GET",
    url: "/marketplace/:chain/:contractAddress/offers/get-all-valid",
    schema: {
      summary: "Get all valid offers",
      description:
        "Get all valid offers on this marketplace contract. Valid offers are offers that have not expired, been canceled, or been accepted.",
      tags: ["Marketplace-Offers"],
      operationId: "getAllValid",
      params: requestSchema,
      querystring: requestQuerySchema,
      response: {
        ...standardResponseSchema,
        [StatusCodes.OK]: responseSchema,
      },
    },
    handler: async (request, reply) => {
      const { chain, contractAddress } = request.params;
      const { start, count, offeror, tokenContract, tokenId } = request.query;
      const chainId = getChainIdFromChain(chain);
      const contract = await getContract({
        chainId,
        contractAddress,
      });
      const result = await contract.offers.getAllValid({
        start,
        count,
        tokenContract,
        tokenId,
        offeror,
      });

      const finalResult = result.map((data) => {
        return formatOffersV3Result(data);
      });
      reply.status(StatusCodes.OK).send({
        result: finalResult,
      });
    },
  });
}
