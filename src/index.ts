import {
	VersionedTransaction,
	Connection,
	Keypair,
	PublicKey,
	Transaction,
} from "@solana/web3.js";
import type { Config, QuoteResponse, SwapOptions, SwapResponse } from "./types";
import ora from "ora";
import { TOML } from "bun";
import { decode } from "bs58";
import { readFile } from "fs/promises";
import { setTimeout } from "timers/promises";
import { choice, random } from "./utils";
import {
	getAccount,
	getAssociatedTokenAddressSync,
	getMint,
} from "@solana/spl-token";

export const SWAP_ENDPOINT = "https://quote-api.jup.ag/v6/swap";
export const QUOTE_ENDPOINT = "https://quote-api.jup.ag/v6/quote";

class SwaperJupiter {
	keypair: Keypair;
	connection: Connection;

	constructor(connection: Connection, keypair: Keypair) {
		this.connection = connection;
		this.keypair = keypair;
	}

	async swap({
		inputMint,
		outputMint,
		amount,
		slippage,
		swapMode,
		onlyDirectRoutes,
		asLegacyTransaction,
		excludeDexes,
		wrapSol,
		maxAccounts,
	}: SwapOptions) {
		const owner = this.keypair.publicKey;

		const quoteResponse = await this.quote(
			inputMint,
			outputMint,
			amount,
			slippage,
			swapMode,
			onlyDirectRoutes,
			asLegacyTransaction,
			excludeDexes,
			maxAccounts,
		);

		const data = (await (
			await fetch(SWAP_ENDPOINT, {
				body: JSON.stringify({
					userPublicKey: owner.toString(),
					wrapAndUnwrapSol: Boolean(wrapSol),
					quoteResponse,
					asLegacyTransaction,
				}),
				method: "POST",
			})
		).json()) as SwapResponse;

		if ("error" in data) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			throw new Error(data.error as any);
		}

		return Transaction.from(Buffer.from(data.swapTransaction, "base64"));
	}

	async quote(
		inputMint: PublicKey,
		quoteMint: PublicKey,
		amount: number,
		slippage?: number,
		swapMode?: string,
		onlyDirectRoutes?: boolean,
		asLegacyTransaction?: boolean,
		excludeDexes?: string[],
		maxAccounts?: number,
	): Promise<QuoteResponse> {
		let url = `${QUOTE_ENDPOINT}?inputMint=${inputMint.toString()}&outputMint=${quoteMint.toString()}&amount=${amount}&swapMode=${
			swapMode ? swapMode : "ExactIn"
		}&onlyDirectRoutes=${
			onlyDirectRoutes ? JSON.stringify(onlyDirectRoutes) : "false"
		}&asLegacyTransaction=${
			asLegacyTransaction ? JSON.stringify(asLegacyTransaction) : "true"
		}`;

		if (excludeDexes?.length) {
			url += `&excludeDexes=${excludeDexes}`;
		}

		if (slippage) {
			url += `&slippageBps=${slippage}`;
		}

		if (maxAccounts) {
			url += `&maxAccounts=${maxAccounts}`;
		}

		const data = (await fetch(url).then((r) => r.json())) as QuoteResponse;

		if ("error" in data) {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			throw new Error(data.error as any);
		}

		return data;
	}
}

async function sendTransaction(
	connection: Connection,
	tx: Transaction,
	feePayer: PublicKey,
	signers: Keypair[],
) {
	tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
	tx.feePayer = feePayer;
	tx.sign(...signers);

	return await connection.sendRawTransaction(tx.serialize());
}

async function getDecimals(connection: Connection, mint: PublicKey) {
	const mintData = await getMint(connection, mint);
	return mintData.decimals;
}

async function main() {
	const spinner = ora("СТАРТИНГ Аккаунтс процессинг!!!!").start();

	const config = TOML.parse(
		await readFile("./config.toml", { encoding: "utf8" }),
	) as Config;

	let feePayer: Keypair | undefined = undefined;

	if (config.fee_payer) {
		feePayer = Keypair.fromSecretKey(decode(config.fee_payer));
	}

	if (!config.input_mints && !config.output_mints) {
		return spinner.fail(
			"Ну ты совсем? Почему ты не указал куда во что свопать?",
		);
	}

	const inputsMints = Object.entries(config.input_mints).map(
		([tokenRaw, data]) => [new PublicKey(tokenRaw), data],
	) as [PublicKey, { amount_range: [number, number] }][];

	const outputMints = Object.entries(config.output_mints).map(
		([tokenRaw, data]) => [new PublicKey(tokenRaw), data],
	) as [PublicKey, { sell_percentages: number[] }][];

	if (
		outputMints.some(
			([_, data]) => data.sell_percentages.reduce((a, c) => a + c, 0) > 100,
		)
	) {
		return spinner.fail("Ну ты чего, у тебя в сумме проценты больше 100");
	}

	if (!config.rpc_url) {
		return spinner.fail("Ну почему ты не указал rpc_url?");
	}

	const connection = new Connection(config.rpc_url);

	if (!config.accounts_path) {
		return spinner.fail(
			"Ну что ж такое то?? все вроде указал, а accounts_path нет...",
		);
	}

	let accounts: Keypair[];

	try {
		accounts = (await readFile(config.accounts_path, { encoding: "utf-8" }))
			.split("\n")
			.map(decode)
			.map((kp) => Keypair.fromSecretKey(kp));
	} catch (e) {
		return spinner.fail("Ну файла то с аккаунтами нет!");
	}

	spinner.text = `Загружено ${accounts.length} аккаунтов`;
	await setTimeout(5000);

	for (const account of accounts) {
		spinner.text = `ПРОЦЕССИНГ ${account.publicKey.toString()}`;
		const jupSwap = new SwaperJupiter(connection, account);

		const [inputMint, { amount_range }] = choice(inputsMints);
		const [outputMint, { sell_percentages }] = choice(outputMints);

		const inputMintDecimals = await getDecimals(connection, inputMint);

		const amount = random(
			...(amount_range.map(
				(value) => value * 10 ** inputMintDecimals,
			) as unknown as [number, number]),
		);

		const tx = await jupSwap.swap({
			inputMint,
			outputMint,
			amount,
			asLegacyTransaction: true,
		});

		spinner.text = await sendTransaction(
			connection,
			tx,
			feePayer ? feePayer.publicKey : account.publicKey,
			feePayer ? [feePayer, account] : [account],
		);

		const tokenAccount = await getAccount(
			connection,
			getAssociatedTokenAddressSync(outputMint, account.publicKey),
		);

		const outputMintAmounts = sell_percentages.map(
			(percentage) => Number(tokenAccount.amount) * (percentage / 100),
		);

		const txs = await Promise.all(
			outputMintAmounts.map((amount) =>
				jupSwap.swap({
					inputMint: outputMint,
					outputMint: inputMint,
					amount,
				}),
			),
		);

		const sigs = await Promise.all(
			txs.map((tx) =>
				sendTransaction(
					connection,
					tx,
					feePayer ? feePayer.publicKey : account.publicKey,
					feePayer ? [feePayer, account] : [account],
				),
			),
		);

		spinner.text = sigs.join(", ");
		await setTimeout(5000);
	}
}

await main();
