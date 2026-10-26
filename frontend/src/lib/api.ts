const API_BASE_PATH = "/api"
const BASE_URL = 
    process.env.NEXT_PUBLIC_API_URL || 
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)

function apiUrl(path: string): string {
    if(typeof window !== "undefined") {
        return `${API_BASE_PATH}${path}`
    } else if (!BASE_URL) {
        throw new Error("Neither NEXT_PUBLIC_API_URL nor VERCEL_PROJECT_PRODUCTION_URL are set.")
    } else {
        return (BASE_URL + API_BASE_PATH + path)
    }
}

export { apiUrl }