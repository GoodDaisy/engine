import { SocketStream } from "@fastify/websocket";
import { Static } from "@sinclair/typebox";
import { FastifyRequest } from "fastify";
import {
  TransactionStatusEnum,
  transactionResponseSchema,
} from "../schemas/transaction";
import { UserSubscription, subscriptionsData } from "../schemas/websocket";

// websocket timeout, i.e., ws connection closed after 10 seconds
const timeoutDuration = 10 * 60 * 1000;

export const findWSConnectionInSharedState = async (
  connection: SocketStream,
  request: FastifyRequest,
): Promise<number> => {
  const index = subscriptionsData.findIndex(
    (sub) => sub.socket === connection.socket,
  );
  return index;
};

export const removeWSFromSharedState = async (
  connection: SocketStream,
  request: FastifyRequest,
): Promise<number> => {
  const index = await findWSConnectionInSharedState(connection, request);
  if (index == -1) {
    return -1;
  }
  subscriptionsData.splice(index, 1);
  return index;
};

export const onError = async (
  error: Error,
  connection: SocketStream,
  request: FastifyRequest,
): Promise<void> => {
  request.log.error(error, "Websocket Error");
  const index = await findWSConnectionInSharedState(connection, request);
  if (index == -1) {
    return;
  }

  const userSubscription = subscriptionsData[index];
  subscriptionsData.splice(index, 1);
  userSubscription.socket.send(
    JSON.stringify({
      result: null,
      requestId: userSubscription.requestId,
      status: "error",
      message: error.message,
    }),
  );

  connection.socket.close();
};

export const onMessage = async (
  connection: SocketStream,
  request: FastifyRequest,
): Promise<void> => {
  const index = await findWSConnectionInSharedState(connection, request);
  const userSubscription = subscriptionsData[index];
  subscriptionsData.splice(index, 1);
  userSubscription.socket.send(
    JSON.stringify({
      result: null,
      requestId: userSubscription.requestId,
      status: "error",
      message: "Do not send any message. Closing Socket... Reconnect again.",
    }),
  );
  userSubscription.socket.close();
};

export const onClose = async (
  connection: SocketStream,
  request: FastifyRequest,
): Promise<void> => {
  const index = await findWSConnectionInSharedState(connection, request);
  if (index == -1) {
    return;
  }
  subscriptionsData.splice(index, 1);
};

export const wsTimeout = async (
  connection: SocketStream,
  queueId: string,
  request: FastifyRequest,
): Promise<NodeJS.Timeout> => {
  return setTimeout(() => {
    connection.socket.send("Timeout exceeded. Closing connection...");
    removeWSFromSharedState(connection, request);
    connection.socket.close(1000, "Session timeout"); // 1000 is a normal closure status code
    request.log.info(
      `Websocket connection for ${queueId} closed due to timeout.`,
    );
  }, timeoutDuration);
};

export const findOrAddWSConnectionInSharedState = async (
  connection: SocketStream,
  queueId: string,
  request: FastifyRequest,
) => {
  let userSubscription: UserSubscription | undefined = undefined;
  const index = await findWSConnectionInSharedState(connection, request);
  if (index > -1) {
    userSubscription = subscriptionsData[index];
  } else {
    userSubscription = {
      socket: connection.socket,
      requestId: queueId,
    };

    subscriptionsData.push(userSubscription);
  }
};

type CustomStatusAndConnectionType = {
  message: string;
  closeConnection: boolean;
};

export const getStatusMessageAndConnectionStatus = async (
  data: Static<typeof transactionResponseSchema> | null,
): Promise<CustomStatusAndConnectionType> => {
  let message =
    "Request is queued. Waiting for transaction to be picked up by worker.";
  let closeConnection = false;

  if (!data) {
    message = `Transaction not found. Make sure the provided ID is correct.`;
    closeConnection = true;
  } else if (data.status === TransactionStatusEnum.Mined) {
    message = "Transaction mined. Closing connection.";
    closeConnection = true;
  } else if (data.status === TransactionStatusEnum.Errored) {
    message = data.errorMessage || "Transaction errored. Closing connection.";
    closeConnection = true;
  } else if (data.status === TransactionStatusEnum.Submitted) {
    message =
      "Transaction submitted to blockchain. Waiting for transaction to be mined...";
  } else if (data.status === TransactionStatusEnum.Processed) {
    message = "Worker is processing the transaction. Please wait...";
  }

  return { message, closeConnection };
};

export const formatSocketMessage = async (
  data: Static<typeof transactionResponseSchema> | null,
  message: string,
): Promise<string> => {
  const returnData = JSON.stringify({
    result: data ? JSON.stringify(data) : undefined,
    queueId: data?.queueId,
    message,
  });
  return returnData;
};
