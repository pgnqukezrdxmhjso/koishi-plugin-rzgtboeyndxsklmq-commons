import { Context, Schema } from "koishi";

export * from "./utils/BeanHelper";
export * from "./utils/File";
export * from "./utils/Test";

export const name = "rzgtboeyndxsklmq-commons";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context, config: Config) {}
