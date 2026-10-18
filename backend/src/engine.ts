type RequirementsProfile = {
  category: Category | null,
  osPreference: OsType | null,
  minRamGb: number | null,
  minVramGb: number | null,
  minCpuScore: number | null,
  minStorageGb: number | null,
  eccRequired: boolean,
  integratedGraphicsOk: boolean,
  maxPriceUsd: number | null,
  portabilityImportant: boolean,
  localAiWorkloads: boolean,
  longevityYears: number | null
}

type CategoryAverages = {
  [category: string]: {
    avgWeightKg: number
    avgLengthMm: number
    avgWidthMm: number
  }
}

type FilterProfile = {
  category: Category | null,
  osPreference: OsType | null,
  minRamGb: number | null,
  minVramGb: number | null,
  minCpuScore: number | null,
  minStorageGb: number | null,
  eccRequired: boolean,
  maxPriceUsd: number | null,
}

type OsType = "windows" | "macos" | "linux"


type Category = "desktop" | "laptop" | "workstation" | "mini_pc"


export type { Category }
export type { OsType }
export type { FilterProfile }
export type { RequirementsProfile }
export type { CategoryAverages }

const DEFAULT_AI_VRAM_GB = 8

function hardFilter(systems: any[], profile: RequirementsProfile | FilterProfile): any[] {
  const { minRamGb, minVramGb, minCpuScore, minStorageGb } = profile
  return systems.filter((system) => {
    const cpuPassmarkScore = Math.max(0, ...system.systemCpus.map((entry: any) => entry.cpu.passmarkScore ?? 0))
    const vramGb = Math.max(0, ...system.systemGpus.map((entry: any) => entry.gpu.vramGb ?? 0))
    let ramGb = 0
      for(const entry of system.systemRam) {
        ramGb += entry.ramConfig.capacityGb ?? 0
      }
    let storageGb = 0
      for(const entry of system.systemStorage) {
        storageGb += entry.storageConfig.capacityGb ?? 0
      }
    if (profile.category && system.category !== profile.category) {
      return false
    }
    if (profile.osPreference && system.os !== profile.osPreference) {
      return false
    }
    if (minRamGb && minRamGb > ramGb) {
      return false
    }
    if (minVramGb && minVramGb > vramGb) {
      return false
    }
    if (minCpuScore && minCpuScore > cpuPassmarkScore) {
      return false
    }
    if (minStorageGb && minStorageGb > storageGb) {
      return false
    }
    if (profile.eccRequired &&
      !system.systemCpus.some((entry: any) => entry.cpu?.eccSupport === true) &&
      !system.systemRam.some((entry: any) => entry.ramConfig?.eccSupport === true)) {
      return false
    }
    if (profile.maxPriceUsd && system.priceUsd > profile.maxPriceUsd) {
      return false
    }
    return true
  })
}

export { hardFilter }

function scoreSystem(system: any, profile: RequirementsProfile, categoryAverages: CategoryAverages) {
  let maxScore = 0
  let score = 0
  const cpuWeight = 0.25
  const vramWeight = 0.20
  const priceWeight = 0.20
  const ramWeight = 0.20
  const storageWeight = 0.10
  const dimensionWeight = 0.05

  const averages = categoryAverages[system.category]
  if (profile.minCpuScore) {
    maxScore += cpuWeight
    const passmarkScore = system.systemCpus[0]?.cpu?.passmarkScore ?? 0
    score += cpuWeight * Math.min((passmarkScore / profile.minCpuScore), 1)
  }
  if (profile.localAiWorkloads) {
    const targetVramGb = profile.minVramGb || DEFAULT_AI_VRAM_GB
    if (targetVramGb !== 0 ){
      maxScore += vramWeight
      const systemVramGb = system.systemGpus[0]?.gpu?.vramGb ?? 0
      score += Math.min((vramWeight * (systemVramGb / targetVramGb)), vramWeight)
    } 
  }
  if (profile.maxPriceUsd) {
    maxScore += priceWeight
    score += priceWeight * Math.min(((profile.maxPriceUsd - system.priceUsd) / profile.maxPriceUsd), 1)
  }
  if (profile.minRamGb) {
    maxScore += ramWeight
    const ramGb = system.systemRam[0]?.ramConfig?.capacityGb ?? 0
    score += ramWeight * Math.min((ramGb / profile.minRamGb), 1)
  }
  if (profile.minStorageGb) {
    maxScore += storageWeight
    const storageGb = system.systemStorage[0]?.storageConfig?.capacityGb ?? 0
    score += storageWeight * Math.min((storageGb / profile.minStorageGb), 1)
  }
  if (profile.portabilityImportant && averages && system.weightKg && system.lengthMm && system.widthMm) {
    maxScore += dimensionWeight
    const weightRatio = (averages.avgWeightKg / system.weightKg)
    const dimensionRatio = (averages.avgLengthMm * averages.avgWidthMm) / (system.lengthMm * system.widthMm)
    score += dimensionWeight * ((weightRatio + dimensionRatio) / 2)
  }

  return maxScore > 0 ? score / maxScore : 0
}

export { scoreSystem }

function rankSystems(systems: any[], profile: RequirementsProfile, categoryAverages: CategoryAverages) {
  const filteredList = hardFilter(systems, profile)
  const scoredList = filteredList.map((system) => ({
    system,
    score: scoreSystem(system, profile, categoryAverages)
  }))
  scoredList.sort((a, b) => b.score - a.score)
  const finalList = scoredList.map((entry) => entry.system)
  return finalList
}

export { rankSystems }