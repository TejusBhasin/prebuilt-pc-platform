"use client"
import { useState, useEffect, ChangeEvent } from "react";
import { SystemCategory, System } from "@/lib/types";
import Link from "next/link"
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

type OsType = "windows" | "macos" | "linux" 

const CATEGORY_OPTIONS: SystemCategory[] = ["desktop", "laptop", "mini_pc", "workstation"]

const OS_OPTIONS: OsType[] = ["windows", "macos", "linux"]

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
    const [cpuLoading, setCpuLoading] = useState<boolean>(true)
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
                setCpuLoading(false)
            }
        }
        getCpuOptions()
    }, [])
    function getWrittenCategoryOption(option: string){
        if(option === "desktop") {
            return "Desktop"
        } else if (option === "laptop") {
            return "Laptop"
        } else if (option === "mini_pc") {
            return "Mini PC"
        } else if (option === "workstation") {
            return "Workstation"
        } 
    }
    function handleCategoryChange(event: ChangeEvent<HTMLSelectElement>) {
        const rawCategoryValue = event.target.value
        if(rawCategoryValue === "") {
            setFilterProfile(previousProfile => ({ ...previousProfile, category: null}))
        } else {
            const categoryValue = rawCategoryValue as SystemCategory
            setFilterProfile(previousProfile => ({ ...previousProfile, category: categoryValue}))
        }
        
    }
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
    function handleVramChange(event: ChangeEvent<HTMLInputElement>) {
        const rawVramValue = event.target.value
        if (rawVramValue === "") {
            setFilterProfile(previousProfile => ({ ...previousProfile, minVramGb: null}))
        } else {
            const vramValue = Number(rawVramValue)
            setFilterProfile(previousProfile => ({ ...previousProfile, minVramGb: vramValue}))
        }
    }
    function handleStorageChange(event: ChangeEvent<HTMLInputElement>) {
        const rawStorageValue = event.target.value
        if (rawStorageValue === "") {
            setFilterProfile(previousProfile => ({ ...previousProfile, minStorageGb: null}))
        } else {
            const storageValue = Number(rawStorageValue)
            setFilterProfile(previousProfile => ({ ...previousProfile, minStorageGb: storageValue}))
        }
    }
    function handleRamChange(event: ChangeEvent<HTMLInputElement>){
        const rawRamValue = event.target.value
        if (rawRamValue === "") {
            setFilterProfile(previousProfile => ({ ...previousProfile, minRamGb: null}))
        } else {
            const ramValue = Number(rawRamValue)
            setFilterProfile(previousProfile => ({ ...previousProfile, minRamGb: ramValue}))
        }
    }
    function handleOsChange(event: ChangeEvent<HTMLSelectElement>){
        const rawOsValue = event.target.value
        if(rawOsValue === "") {
            setFilterProfile(previousProfile => ({ ...previousProfile, osPreference: null}))
        } else {
            const osValue = rawOsValue as OsType
            setFilterProfile(previousProfile => ({ ...previousProfile, osPreference: osValue}))
        }
    }
    function getWrittenOsOption(option: string) {
        if(option === "macos") {
            return "macOS"
        } else if (option === "windows") {
            return "Windows"
        } else if (option === "linux") {
            return "Linux"
        }
    }
    function handleMaxPriceChange(event: ChangeEvent<HTMLInputElement>){
        const rawMaxPriceValue = event.target.value
        if (rawMaxPriceValue === "") {
            setFilterProfile(previousProfile => ({ ...previousProfile, maxPriceUsd: null}))
        } else {
            const maxPriceValue = Number(rawMaxPriceValue)
            setFilterProfile(previousProfile => ({ ...previousProfile, maxPriceUsd: maxPriceValue}))
        }
    }
    function handleEccChange(event: ChangeEvent<HTMLInputElement>) {
        const eccValue: boolean = event.target.checked
        setFilterProfile(previousProfile => ({ ...previousProfile, eccRequired: eccValue}))
    }
    
    const [results, setResults] = useState<System[]>([])
    const [resultsLoading, setResultsLoading] = useState<boolean>(true)
    const [resultsError, setResultsError] = useState<boolean>(false)
    useEffect(() => {
        const controller = new AbortController()
        async function getResults() {
            try {
                setResultsLoading(true)
                setResultsError(false)
                const options = {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(filterProfile),
                    signal: controller.signal
                }
                const response = await fetch("http://localhost:3001/systems/filter", options)
                if (!response.ok) {
                    throw new Error(`Failed to fetch results: ${response.status}`)
                }
                const data: System[] = await response.json()
                setResults(data)
                setResultsLoading(false)
            } catch (err) {
                if(err instanceof DOMException && err.name === "AbortError") {
                    return
                } 
                setResultsError(true)
                setResultsLoading(false)
            }
        } 
        getResults()
        return (() => {
            controller.abort()
        })
    }, [filterProfile])
    let statusText = ""
    
    if (resultsError === true) {
        statusText = "An error occurred. Adjust your specs and try again."
    } else if (resultsLoading === true) {
        statusText = "Loading results..."
    }  else if (results.length === 0) {
        statusText = "No results found. Adjust your specs and try again."
    } else if (results.length === 1){
        statusText = "1 result found."
    } else {
        statusText = `${results.length} results found.`
    }
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-6 bg-panel border border-hairline rounded-md p-6 h-[calc(100vh-6rem)] overflow-y-auto min-w-0 w-full">
                <div className="flex flex-col gap-1">
                <label className="font-body text-text-muted">Category</label>
                <select id="categoryOption" value={filterProfile.category ?? ""} onChange={handleCategoryChange} className="bg-panel border border-hairline font-body text-text-primary focus:border-accent-teal px-3 py-2">
                    <option value="">Any</option>
                    {CATEGORY_OPTIONS.map((option) => (
                    <option
                        key={option}
                        value={option}
                    >
                        {getWrittenCategoryOption(option)}
                    </option>
                ))}</select>
                </div>
                <div className="flex flex-col gap-1">
                <label className="font-body text-text-muted">CPU Performance</label>
                    <p className="font-body text-xs text-text-muted">What CPU should the system's CPU have equivalent performance to?</p>
                <select id="cpuOption" value={selectedCpuId ?? ""} onChange={handleCpuChange} disabled={cpuLoading} className="bg-panel border border-hairline font-body text-text-primary focus:border-accent-teal disabled:opacity-40 disabled:pointer-events-none px-3 py-2">
                    <option value="">{cpuLoading ? "Loading CPUs..." : "Any"}</option>
                    {cpuOptions.map((option) => (
                    <option
                        key={option.id}
                        value={option.id}
                    >
                        {option.name}
                    </option>
                ))}</select>
                {cpuLoadError && <p className="font-body text-text-muted">Failed to load CPU list</p>}
                </div>
                <div className="flex flex-col gap-1">
                <label className="font-body text-text-muted">VRAM (GB)</label>
                <input type="number" min={0} id="vramOption" value={filterProfile.minVramGb ?? ""} placeholder="Any" onChange={handleVramChange} className="bg-panel border border-hairline font-body text-text-primary px-3 py-2 focus:border-accent-teal" />
                </div>
                <div className="flex flex-col gap-1">
                <label className="font-body text-text-muted">RAM (GB)</label>
                <input type="number" min={0} id="ramOption" value={filterProfile.minRamGb ?? ""} placeholder="Any" onChange={handleRamChange} className="bg-panel border border-hairline font-body text-text-primary px-3 py-2 focus:border-accent-teal" />
                </div>
                <div className="flex flex-col gap-1">
                <label className="font-body text-text-muted">Storage (GB)</label>
                <input type="number" min={0} id="storageOption" value={filterProfile.minStorageGb ?? ""} placeholder="Any" onChange={handleStorageChange} className="bg-panel border border-hairline font-body text-text-primary px-3 py-2 focus:border-accent-teal" />
                </div>
                <div className="flex flex-col gap-1">
                <label className="font-body text-text-muted">OS</label>
                <select id="osOption" value={filterProfile.osPreference ?? ""} onChange={handleOsChange} className="bg-panel border border-hairline font-body text-text-primary focus:border-accent-teal px-3 py-2">
                    <option value="">Any</option>
                    {OS_OPTIONS.map((option) => (
                    <option
                        key={option}
                        value={option}
                    >
                        {getWrittenOsOption(option)}
                    </option>
                ))}</select>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                <label className="font-body text-text-muted">Max Price (USD)</label>
                <input type="number" min={0} id="maxPriceOption" value={filterProfile.maxPriceUsd ?? ""} placeholder="Any" onChange={handleMaxPriceChange} className="bg-panel border border-hairline font-body text-text-primary px-3 py-2 focus:border-accent-teal" />
                </div>
                <div className="flex items-center gap-2">
                <label className="font-body text-text-muted">ECC</label>
                <input type="checkbox" id="eccOption" checked={filterProfile.eccRequired} onChange={handleEccChange} className="px-3 py-2 accent-accent-copper" />
                </div>
                {
                    //<pre>{JSON.stringify(filterProfile, null, 2)}</pre>
                    //<pre>Results Error: {String(resultsError)}</pre>
                    //<pre>Results Loading: {String(resultsLoading)}</pre>
                }
            </div>
            <div className="bg-panel border border-hairline rounded-md p-6 h-[calc(100vh-6rem)] overflow-y-auto min-w-0 w-full">
                <h2 className="font-heading text-text-primary">Results</h2>
               <p className="font-body text-text-muted text-sm mb-4">{statusText}</p>
                <div className="divide-y divide-hairline">
                {results.map((result) => (
                    <Link key={result.id} href={"/systems/" + result.id} className="flex items-center gap-4 py-4">
                        <div className="flex flex-col flex-1 gap-1 min-w-0">
                            <div className="flex justify-between items-baseline gap-2">
                                <h3 className="font-heading text-text-primary">{result.name}</h3>
                                <span className="font-mono text-accent-copper">${result.priceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex">
                                <p className="font-mono text-text-muted text-sm">
                                    {result.systemCpus[0]?.cpu.name} · {result.systemGpus[0]?.gpu.name} · {result.systemRam[0]?.ramConfig.capacityGb}GB {result.systemRam[0]?.ramConfig.type}
                                </p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
            </div>
        </div>
    )
}
export default FilterStep