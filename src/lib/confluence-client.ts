/**
 * @fileoverview A simple client for interacting with the Confluence Cloud REST API.
 */

/**
 * Fetches data from the Confluence API.
 * @param path The API endpoint path (e.g., '/rest/api/content').
 * @param options Additional fetch options.
 * @returns The JSON response from the API.
 */
async function fetchConfluenceAPI(path: string, options: RequestInit = {}): Promise<any> {
  const { CONFLUENCE_BASE_URL, CONFLUENCE_USER_EMAIL, CONFLUENCE_API_TOKEN } = process.env;

  const missingVars = [];
  if (!CONFLUENCE_BASE_URL) missingVars.push('CONFLUENCE_BASE_URL');
  if (!CONFLUENCE_USER_EMAIL) missingVars.push('CONFLUENCE_USER_EMAIL');
  if (!CONFLUENCE_API_TOKEN) missingVars.push('CONFLUENCE_API_TOKEN');

  if (missingVars.length > 0) {
    const errorMessage = `The following Confluence environment variables are missing: ${missingVars.join(', ')}. Please check your .env file.`;
    throw new Error(errorMessage);
  }

  const url = `${CONFLUENCE_BASE_URL}${path}`;
  const authToken = Buffer.from(`${CONFLUENCE_USER_EMAIL}:${CONFLUENCE_API_TOKEN}`).toString('base64');
  
  const headers = {
    'Authorization': `Basic ${authToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Confluence API request failed with status ${response.status}: ${errorText}`);
  }

  // Check for empty response body
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      return text ? JSON.parse(text) : {};
  }
  
  return {};
}

/**
 * Gets server info from Confluence. A good way to test the connection.
 * @see https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-server-info/#api-rest-api-settings-systeminfo-get
 */
export async function getConfluenceServerInfo() {
  return await fetchConfluenceAPI('/wiki/rest/api/settings/systemInfo');
}

/**
 * Gets content from a specific space in Confluence.
 * @param spaceKey The key of the space to get content from.
 * @param type The type of content to get ('page', 'blogpost', etc.).
 * @param limit The maximum number of results to return.
 * @param start The start index for pagination.
 * @see https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-content/#api-wiki-rest-api-content-get
 */
export async function getSpaceContent(spaceKey: string, type: string = 'page', limit: number = 25, start: number = 0) {
  const path = `/wiki/rest/api/content?spaceKey=${spaceKey}&type=${type}&limit=${limit}&start=${start}&expand=body.storage,version,metadata.labels`;
  return await fetchConfluenceAPI(path);
}

/**
 * Gets a specific content item by ID.
 * @param contentId The ID of the content to get.
 * @see https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-content/#api-wiki-rest-api-content-id-get
 */
export async function getContentById(contentId: string) {
  const path = `/wiki/rest/api/content/${contentId}?expand=body.storage,version,metadata.labels`;
  return await fetchConfluenceAPI(path);
}

/**
 * Gets all content from a space recursively.
 * @param spaceKey The key of the space to get content from.
 * @param type The type of content to get ('page', 'blogpost', etc.).
 */
export async function getAllSpaceContent(spaceKey: string, type: string = 'page') {
  const allContent = [];
  let start = 0;
  const limit = 25;

  while (true) {
    const response = await getSpaceContent(spaceKey, type, limit, start);
    const { results, size, _links } = response;
    
    allContent.push(...results);
    
    if (!_links?.next || size < limit) {
      break;
    }
    
    start += limit;
  }

  return allContent;
}