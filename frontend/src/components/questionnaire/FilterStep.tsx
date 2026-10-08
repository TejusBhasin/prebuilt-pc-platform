"use client"
import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Cpu } from "@/lib/types";

type FilterProfile = {
    category: "desktop" | "laptop" | "mini_pc" | "workstation" | null,
    osPreference: "windows" | "macos" | "linux" | null,
    minRamGb: number | null,
    minVramGb: number | null,
    minCpuScore: number | null,
    minStorageGb: number | null,
    eccRequired: boolean,
    maxPriceUsd: number | null,
}

type CpuOption = {
    id: number,
    passmarkScore: number,
    name: string
}
function FilterStep() {
    const [filterProfile, setFilterProfile] = useState<FilterProfile>({
        category: null,
        osPreference: null,
        minRamGb: null,
        minVramGb: null,
        minCpuScore: null,
        minStorageGb: null,
        eccRequired: false,
        maxPriceUsd: null
    })
    const [cpuOptions, setCpuOptions] = useState<CpuOption[]>([])
    const [cpuLoadError, setCpuLoadError] = useState<boolean>(false)
    const [loading, setLoading] = useState<boolean>(true)
    const [selectedCpuId, setSelectedCpuId] = useState<number | null>(null)
    useEffect(() => {
        async function getCpuOptions() {
            try {
                const response = await fetch("http://localhost:3001/cpus/options")
                if (!response.ok) {
                    throw new Error(`Failed to fetch CPU options: ${response.status}`)
                }
                const parsedResponse = await response.json()
                setCpuOptions(parsedResponse)
            } catch (err) {
                setCpuLoadError(true)
            } finally {
                setLoading(false)
            }
        }
        getCpuOptions()
    }, [])
    function handleCpuChange(event: ChangeEvent<HTMLSelectElement>) {
        const rawCpuValue = event.target.value
        if (rawCpuValue === "") {
            setSelectedCpuId(null)
            setFilterProfile(previousProfile => ({ ...previousProfile, minCpuScore: null }))
        } else {
            const cpuValue = Number(rawCpuValue)
            const selectedCpu = cpuOptions.find((option) => (
                option.id === cpuValue
            ))
            setSelectedCpuId(cpuValue)
            setFilterProfile(previousProfile => ({ ...previousProfile, minCpuScore: selectedCpu?.passmarkScore ?? null }))
        }
    }
    return (
        <div>
            <label className="font-body text-text-muted">CPU Options</label>
            <select id="cpuOption" value={selectedCpuId ?? ""} onChange={handleCpuChange} disabled={loading} className="bg-panel border border-hairline font-body text-text-primary focus:border-accent-teal disabled:opacity-40 disabled:pointer-events-none px-3 py-2"><option value="">{loading ? "Loading CPUs..." : "Any"}</option>{cpuOptions.map((option) => (
                <option
                    key={option.id}
                    value={option.id}
                >
                    {option.name}
                </option>
            ))}</select>
            {cpuLoadError && <p className="font-body text-text-muted">Failed to load CPU list</p>}
        </div>
    )
}
export default FilterStep