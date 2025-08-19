import { z } from "zod";

export type ConfigurationValue<T> = {
  value: T;
  description: string;
};

export type Configuration = {
  botProfilePicture: ConfigurationValue<string | undefined>;
  chatBubblePicture: ConfigurationValue<string | undefined>;
  suggestedQuestions: ConfigurationValue<string[]>;
  botName: ConfigurationValue<string>;
};

export const UpdateConfigurationArgsSchema = z.object({
  botProfilePicture: z.string().nullable(),
  chatBubblePicture: z.string().nullable(),
  suggestedQuestions: z.array(z.string()),
  botName: z.string(),
});

export type UpdateConfigurationArgs = z.infer<
  typeof UpdateConfigurationArgsSchema
>;
export interface ConfigurationRepository {
  getConfiguration(): Promise<Configuration>;
  updateConfiguration(configuration: UpdateConfigurationArgs): Promise<void>;
}
