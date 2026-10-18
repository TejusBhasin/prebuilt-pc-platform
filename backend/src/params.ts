function parseId(raw: string | undefined): number | null {
    if (!raw) {
        return null
    }
    const id = Number(raw)
    if (!Number.isInteger(id) || id < 1) {
        return null
    }
    return id
}

export { parseId }
