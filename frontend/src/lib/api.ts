const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

function apiUrl(path: string): string {
    if (!API_BASE_URL) {
        throw new Error("NEXT_PUBLIC_API_URL is not set")
    }
    return `${API_BASE_URL}${path}`
}

export { apiUrl }
