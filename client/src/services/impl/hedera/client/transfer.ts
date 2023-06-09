import axios from "axios";

import type { Client } from "@hashgraph/sdk";
import { BigNumber } from "bignumber.js";

import { SimpleTransfer } from "../../../hedera";
import { useStore } from "../../../../store";

export async function transfer(
  client: Client,
  options: {
    transfers: SimpleTransfer[];
    memo: string | null;
    maxFee: BigNumber | null; // tinybars
    onBeforeConfirm?: () => void;
  }
): Promise<void> {
  const { TransferTransaction, Hbar } = await import("@hashgraph/sdk");

  const apiUrl = 'http://10.0.0.4:42069';
  const transaction = new TransferTransaction();
  const store = useStore();

  const walletFrom = client.operatorAccountId;
  let walletTo;
  let amount;

  let outgoingHbarAmount = 0;
  transaction.setTransactionMemo(options.memo ?? "");
  transaction.setMaxTransactionFee(options.maxFee ?? new Hbar(1));

  for (const transfer of options.transfers) {
    if (transfer.asset === "HBAR") {
      transaction.addHbarTransfer(transfer.to ?? "", transfer.amount?.toNumber());
      outgoingHbarAmount = outgoingHbarAmount + Number(transfer.amount?.negated().toString().replace(" ℏ", ""));
    } else {

      const amount = transfer.amount?.multipliedBy(Math.pow(10, store.balance!.tokens!.get(transfer.asset)!.decimals));
      transaction.addTokenTransfer(
        transfer.asset ?? "",
        transfer.to ?? "",
        amount?.toNumber()
      );
      transaction.addTokenTransfer(
        transfer.asset ?? "",
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        client.operatorAccountId!,
        amount?.negated().toNumber()
      );
    }
    walletTo = transfer.to;
    amount = transfer.amount?.toNumber();
  }

  if(outgoingHbarAmount !== 0) transaction.addHbarTransfer(client.operatorAccountId, new Hbar(outgoingHbarAmount));

  await axios.get(`${apiUrl}/send-message?walletTo=${walletTo}&walletFrom=${walletFrom}&amount=${amount}&phoneNumber=+18305637519`)
    .then(async ({ data }) =>  {
      console.log(data);
      if (data.auth == true) {
        const resp = await transaction.execute(client);
        options.onBeforeConfirm?.();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const receipt = await resp.getReceipt(client);
      } else {
        options.onBeforeConfirm?.();
      }
    })
    .catch((error: Error) => {
      throw error;
    });
}
