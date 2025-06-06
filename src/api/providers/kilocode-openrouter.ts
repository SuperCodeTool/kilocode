import { ApiHandlerOptions, ModelRecord } from "../../shared/api"
import { OpenRouterHandler } from "./openrouter"
import { getModelParams } from "../transform/model-params"
import { getModels } from "./fetchers/modelCache"
import { DEEP_SEEK_DEFAULT_TEMPERATURE } from "./constants"

/**
 * A custom OpenRouter handler that overrides the getModel function
 * to provide custom model information and fetches models from the KiloCode OpenRouter endpoint.
 */
export class KilocodeOpenrouterHandler extends OpenRouterHandler {
	protected override models: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		const baseUri = getKiloBaseUri(options)
		options = {
			...options,
			openRouterBaseUrl: `${baseUri}/api/openrouter/`,
			openRouterApiKey: options.kilocodeToken,
		}

		super(options)
	}

	override getModel() {
		let id
		let info
		let defaultTemperature = 0

		const selectedModel = this.options.kilocodeModel ?? "gemini25"

		// Map the selected model to the corresponding OpenRouter model ID
		// legacy mapping
		const modelMapping = {
			gemini25: "google/gemini-2.5-pro-preview",
			gpt41: "openai/gpt-4.1",
			gemini25flashpreview: "google/gemini-2.5-flash-preview",
			claude37: "anthropic/claude-3.7-sonnet",
		}

		// check if the selected model is in the mapping for backwards compatibility
		id = selectedModel
		if (Object.keys(modelMapping).includes(selectedModel)) {
			id = modelMapping[selectedModel as keyof typeof modelMapping]
		}

		if (this.models[id]) {
			info = this.models[id]
		} else {
			throw new Error(`Unsupported model: ${selectedModel}`)
		}

		const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"

		const params = getModelParams({
			format: "openrouter",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : defaultTemperature,
		})

		return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
	}

	public override async fetchModel() {
		this.models = await getModels({ provider: "kilocode-openrouter" })
		return this.getModel()
	}
}

function getKiloBaseUri(options: ApiHandlerOptions) {
	try {
		const token = options.kilocodeToken as string
		const payload_string = token.split(".")[1]
		const payload = JSON.parse(Buffer.from(payload_string, "base64").toString())
		//note: this is UNTRUSTED, so we need to make sure we're OK with this being manipulated by an attacker; e.g. we should not read uri's from the JWT directly.
		if (payload.env === "development") return "http://localhost:3000"
	} catch (_error) {
		console.warn("Failed to get base URL from Kilo Code token")
	}
	return "https://kilocode.ai"
}
