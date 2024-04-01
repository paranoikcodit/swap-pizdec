import type { PublicKey } from "@solana/web3.js";

export interface QuoteResponse {
	inputMint: string;
	inAmount: string;
	outputMint: string;
	outAmount: string;
	otherAmountThreshold: string;
	swapMode: string;
	slippageBps: number;
	platformFee: unknown;
	priceImpactPct: string;
	routePlan: RoutePlan[];
	contextSlot: number;
	timeTaken: number;
}

export interface RoutePlan {
	swapInfo: SwapInfo;
	percent: number;
}

export interface SwapInfo {
	ammKey: string;
	label: string;
	inputMint: string;
	outputMint: string;
	inAmount: string;
	outAmount: string;
	feeAmount: string;
	feeMint: string;
}

export interface SwapResponse {
	swapTransaction: string;
	lastValidBlockHeight: number;
	prioritizationFeeLamports: number;
}

export interface SwapOptions {
	inputMint: PublicKey;
	outputMint: PublicKey;
	amount: number;
	wrapSol?: boolean;
	slippage?: number;
	swapMode?: string;
	onlyDirectRoutes?: boolean;
	asLegacyTransaction?: boolean;
	excludeDexes?: string[];
	maxAccounts?: number;
}

export interface Config {
	accounts_path: string;
	rpc_url: string;
	fee_payer: string;
	input_mints: InputMintRoot;
	output_mints: OutputMintRoot;
}

export interface InputMintRoot {
	[key: string]: {
		amount_range: [number, number];
	};
}

export interface OutputMintRoot {
	[key: string]: { sell_percentages: number[] };
}
