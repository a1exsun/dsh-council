import { describe, expect, it } from 'vitest'
import { copyForSettings, localeCopies, localeFromSettings } from '../src/locales.js'
import { answerPrompt, renderCouncilResult } from '../src/protocol.js'
import { selectionQuestions } from '../src/council.js'
import type { CouncilResult, ModelDirectory, ModelRef } from '../src/types.js'

function model(key: string): ModelRef {
  const [provider = '', id = ''] = key.split('/')
  return { provider, providerName: provider, model: id, modelName: id, key, optionLabel: key }
}

const directory: ModelDirectory = {
  models: [model('p/a'), model('p/b')],
  failures: [{ provider: 'offline', message: 'network error' }],
}

describe('DSH locale mapping', () => {
  it('uses Chinese for zh variants and the DSH English fallback for every other setting', () => {
    expect(localeFromSettings({ preference: 'zh' })).toBe('zh')
    expect(localeFromSettings({ preference: 'zh-Hans' })).toBe('zh')
    expect(localeFromSettings({ preference: 'en' })).toBe('en')
    expect(localeFromSettings({ preference: 'ja' })).toBe('en')
    expect(localeFromSettings(undefined)).toBe('en')
    expect(copyForSettings({ preference: 'zh' })).toBe(localeCopies.zh)
  })

  it('localizes the complete selection flow and model-facing language instruction', () => {
    const english = selectionQuestions(directory, localeCopies.en)
    const chinese = selectionQuestions(directory, localeCopies.zh)
    expect(english.map(question => question.header)).toEqual(['Answerers', 'Reviewers', 'Arbiter', 'Topic'])
    expect(chinese.map(question => question.header)).toEqual(['回答人', '评审人', '裁决人', '议题'])
    expect(english[0]?.detail).toContain('could not be read')
    expect(chinese[0]?.detail).toContain('读取失败')
    expect(answerPrompt('问题', localeCopies.en)).toContain('complete answer in English')
    expect(answerPrompt('Question', localeCopies.zh)).toContain('完整答案必须使用简体中文')
  })

  it('renders every plugin-owned audit label in the selected language', () => {
    const answer = model('p/a')
    const reviewer = model('p/b')
    const result: CouncilResult = {
      selection: { answerers: [answer], reviewers: [reviewer], arbiter: reviewer, question: 'Q' },
      directoryFailures: [],
      answers: [{ answerId: '回答 A', model: answer, text: '答案' }],
      reviews: [{
        reviewId: '评审 1',
        model: reviewer,
        output: {
          evaluations: [{ answerId: '回答 A', strengths: [], weaknesses: [] }],
          consensus: [],
          contradictions: [],
          coverageGaps: [],
          uniqueInsights: [],
          blindSpots: [],
          ranking: ['回答 A'],
        },
      }],
      aggregateRanking: [{ answerId: '回答 A', averageRank: 1, votes: 1 }],
      arbiter: {
        answerMarkdown: '最终答案',
        consensus: [],
        contradictions: [],
        blindSpots: [],
        confidenceNotes: '高置信度',
      },
      failures: [],
    }
    const rendered = renderCouncilResult(result, localeCopies.zh)
    for (const text of ['# 议会裁决', '## 审计摘要', '### 聚合排名', '### 失败与降级', '- 无。']) {
      expect(rendered).toContain(text)
    }
    expect(rendered).not.toContain('Council Decision')
    expect(rendered).not.toContain('Failures and Degradation')
  })
})
