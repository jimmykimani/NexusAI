import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '@/api/client'
import type { EvalRun, MetricsSummary } from '@/types'

export function useMetrics(pollIntervalMs = 30000) {
  const [data, setData] = useState<MetricsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunningEval, setIsRunningEval] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const response = await api.get<MetricsSummary>('/metrics')
      setData(response.data)
      setError(null)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  async function runEval(): Promise<EvalRun | null> {
    setIsRunningEval(true)
    try {
      const response = await api.post<EvalRun>('/metrics/run-eval')
      await load()
      return response.data
    } catch (err) {
      setError(apiErrorMessage(err))
      return null
    } finally {
      setIsRunningEval(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, pollIntervalMs)
    return () => window.clearInterval(timer)
  }, [pollIntervalMs])

  return { data, isLoading, isRunningEval, error, refresh: load, runEval }
}
