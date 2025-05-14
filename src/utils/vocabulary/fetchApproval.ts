import config from "../../config";
import { IWordModel } from "../../types/vocabulary/IWordModel";
import { IWordOnApproval } from "../../types/vocabulary/IWordOnApproval";

/**
 * @function fetchApproval
 * @description Fetches words that are pending approval from the API.
 * @param id - ID of the word to be fetched (not used in the query).
 * @param pageNumber - The page number to fetch.
 * @param limit - The number of items per page.
 * @param language - The language of the words to fetch.
 * @returns - A promise that resolves to an object containing a message, the list of words on approval, total items, current page, and total pages.
 */
export const fetchApproval = async (
    id: string,
    pageNumber: number,
    limit: number,
    language: string
): Promise<{
    message: string
    items: IWordOnApproval[]
    totalItems: number
    currentPage: number
    totalPages: number
}> => {
    // Construct the API request URL with query parameters for pagination and language
    const response = await fetch(
        `${config.api.url}/vocabulary/approval?page=${pageNumber}&limit=${limit}&language=${language}`,
        {
            method: 'GET', // HTTP method for fetching data
            headers: {
                'Content-Type': 'application/json', // Specify the content type as JSON
                Authorization: `Bearer ${config.api.token}`, // Include authorization token in headers
            },
        }
    )

    // Parse the JSON response and cast it to the expected type
    const data = (await response.json()) as {
        message: string
        items: IWordOnApproval[]
        totalItems: number
        currentPage: number
        totalPages: number
    }

    return data // Return the data fetched from the API
}
