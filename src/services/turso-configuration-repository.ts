import { Client } from "@libsql/client";
import {
  Configuration,
  ConfigurationRepository,
  UpdateConfigurationArgs,
  ConfigurationValue,
} from "./configuration-repository.ts";

type RawConfiguration = {
  name: string;
  value: string | undefined;
  type: string;
  description: string;
};

export class TursoConfigurationRepository implements ConfigurationRepository {
  constructor(private readonly _db: Client) {}

  private async getRawConfigurations(
    keys: string[],
  ): Promise<RawConfiguration[]> {
    const placeholders = keys.map(() => "?").join(",");
    const result = await this._db.execute({
      sql: `select name, value, type, description
              from configurations where name in (${placeholders})`,
      args: keys,
    });
    if (result.rows === undefined) {
      throw new Error("Failed to fetch configurations");
    }
    if (result.rows.length !== keys.length) {
      throw new Error(
        `Expected ${keys.length} configurations, but got ${result.rows.length}`,
      );
    }

    // deno-lint-ignore no-explicit-any
    return result.rows.map((row: any) => ({
      name: String(row.name),
      value: row.value ? String(row.value) : undefined,
      type: String(row.type),
      description: String(row.description),
    }));
  }

  private getBlob(
    value: RawConfiguration,
  ): ConfigurationValue<string | undefined> {
    return {
      description: value.description,
      value: value.value,
    };
  }

  private getJSON<T>(
    value: RawConfiguration,
  ): ConfigurationValue<T | undefined> {
    return {
      description: value.description,
      value: value.value ? JSON.parse(value.value) : undefined,
    };
  }

  private mustGetJSON<T>(value: RawConfiguration): ConfigurationValue<T> {
    const parsed = this.getJSON<T>(value);
    if (parsed.value === undefined) {
      throw new Error(`Configuration '${value.name}' is missing or invalid`);
    }
    return parsed as ConfigurationValue<T>;
  }

  private mustGetString(value: RawConfiguration): ConfigurationValue<string> {
    const parsed = this.getString(value);
    if (parsed.value === undefined) {
      throw new Error(`Configuration '${value.name}' is missing or invalid`);
    }
    return parsed as ConfigurationValue<string>;
  }

  private getString(
    value: RawConfiguration,
  ): ConfigurationValue<string | undefined> {
    return {
      description: value.description,
      value: value.value || undefined,
    };
  }

  async getConfiguration(): Promise<Configuration> {
    const rawConfigurations = await this.getRawConfigurations([
      "bot_profile_picture",
      "chat_bubble_picture",
      "suggested_questions",
      "bot_name",
    ]);

    const configMap = new Map(
      rawConfigurations.map((config) => [config.name, config]),
    );

    const botProfilePicture = this.getBlob(
      configMap.get("bot_profile_picture")!,
    );

    const chatBubblePicture = this.getBlob(
      configMap.get("chat_bubble_picture")!,
    );
    const suggestedQuestions = this.mustGetJSON<string[]>(
      configMap.get("suggested_questions")!,
    );

    const botName = this.mustGetString(configMap.get("bot_name")!);

    return {
      botProfilePicture,
      chatBubblePicture,
      suggestedQuestions,
      botName,
    };
  }

  async updateConfiguration(
    configuration: UpdateConfigurationArgs,
  ): Promise<void> {
    await this._db.execute({
      sql: `update configurations set value = case
              when name = ? then ?
              when name = ? then ?
              when name = ? then ?
              when name = ? then ?
            end
      `,
      args: [
        "bot_profile_picture",
        configuration.botProfilePicture,
        "chat_bubble_picture",
        configuration.chatBubblePicture,
        "suggested_questions",
        JSON.stringify(configuration.suggestedQuestions),
        "bot_name",
        configuration.botName,
      ],
    });
  }
}
