import config from "../../config";
interface PartOfSpeech {
    _id: string;
    name_buryat: string;
    name_russian: string;
    code: string;
    language_specific: string;
    description_buryat: string;
    description_russian: string;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Gets a part of speech by ID from the API
 *
 * @param id - Part of speech ID
 * @returns A promise that resolves to an object with a 'message' property and a 'data' property that contains the part of speech
 *
 */
export const getPartOfSpeech = async (
    id: string
): Promise<{ message: string; data: PartOfSpeech[] }> => {
    /**
     * Creates a request to the API to get a part of speech
     *
     * @param method - HTTP method (GET)
     * @param url - URL API (config.api.url) + /vocabulary/parts-of-speech
     * @param headers - headers of the request (Content-Type, Authorization)
     */
    const response = await fetch(
        `${config.api.url}/vocabulary/parts-of-speech`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.api.token}`,
            },
        }
    )

    // Converts the JSON response to the expected type
    const data = (await response.json()) as {
        message: string
        data: PartOfSpeech[]
    }

    return data
}
