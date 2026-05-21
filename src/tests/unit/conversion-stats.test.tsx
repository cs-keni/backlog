import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConversionStats } from '@/components/analytics/ConversionStats'
import { computeConversionStats } from '@/lib/analytics/conversion'
import type { ConversionApplication } from '@/lib/analytics/conversion'

function app(company: string, status: string, title = 'Software Engineer', source = 'github'): ConversionApplication {
  return { company, status, title, source }
}

describe('computeConversionStats', () => {
  it('computes FAANG callback rate from applied applications', () => {
    const apps = [
      app('Google', 'phone_screen'),
      app('Meta', 'technical'),
      app('Amazon', 'applied'),
      app('Apple', 'applied'),
      app('Tiny Co', 'applied'),
      app('Tiny Co', 'applied'),
      app('Tiny Co', 'applied'),
      app('Tiny Co', 'applied'),
      app('Tiny Co', 'applied'),
      app('Tiny Co', 'applied'),
    ]

    const stats = computeConversionStats(apps)

    expect(stats.byTier.find(row => row.tier === 'faang')).toMatchObject({
      applied: 4,
      callbacks: 2,
      rate: 50,
    })
  })

  it('counts only callback statuses as callbacks', () => {
    const stats = computeConversionStats([
      app('Google', 'rejected'),
      app('Meta', 'offer'),
      app('Amazon', 'saved'),
    ])

    expect(stats.totalCallbacks).toBe(1)
  })
})

describe('ConversionStats component', () => {
  it('renders placeholder mode before 5 callbacks', () => {
    const stats = computeConversionStats([
      app('Google', 'phone_screen'),
      app('Meta', 'applied'),
    ])

    render(<ConversionStats data={stats} />)

    expect(screen.getByText(/need 5 callbacks/i)).toBeTruthy()
  })

  it('renders the three best-stat cards', () => {
    const stats = computeConversionStats([
      app('Google', 'phone_screen', 'Software Engineer', 'github'),
      app('Meta', 'technical', 'Software Engineer', 'github'),
      app('Amazon', 'final', 'Software Engineer', 'github'),
      app('Apple', 'offer', 'Software Engineer', 'github'),
      app('Stripe', 'phone_screen', 'Senior Software Engineer', 'manual'),
      app('Salesforce', 'applied', 'Senior Software Engineer', 'manual'),
      app('Tiny Co', 'applied', 'Staff Engineer', 'portal'),
      app('Tiny Co', 'applied', 'Staff Engineer', 'portal'),
    ])

    render(<ConversionStats data={stats} />)

    expect(screen.getByText('Best tier')).toBeTruthy()
    expect(screen.getByText('Best title')).toBeTruthy()
    expect(screen.getByText('Best source')).toBeTruthy()
    expect(screen.getByText(/faang \(100% callback\)/i)).toBeTruthy()
  })
})
