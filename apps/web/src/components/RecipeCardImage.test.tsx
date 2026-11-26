import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RecipeCardImage } from './RecipeCardImage'

vi.mock('./AppIcon', () => ({
  AppIcon: ({ name }: { name: string }) => <svg data-icon={name} aria-hidden="true" />,
}))

afterEach(cleanup)

it.each([
  { types: ['Dinner'], tags: ['Quick', 'Vegetarian'], icon: 'dinner' },
  { types: ['Beverages'], tags: [], icon: 'beverages' },
  { types: [], tags: [' Kage '], icon: 'cake' },
  { types: ['Soep'], tags: [], icon: 'soup' },
  { types: ['Dinner', 'Lunch'], tags: [], icon: 'plate' },
  { types: [], tags: ['Dinner', 'Quick'], icon: 'plate' },
  { types: ['Dinner', 'Family special'], tags: [], icon: 'plate' },
  { types: ['Family special'], tags: [], icon: 'plate' },
  { types: [], tags: [], icon: 'plate' },
])('uses $icon for types $types and tags $tags', ({ types, tags, icon }) => {
  const { container } = render(<RecipeCardImage recipe={{ image_url: null, recipe_types: types, tags }} />)
  const placeholder = container.querySelector('.recipe-card__image > svg')
  expect(placeholder).toHaveAttribute('data-icon', icon)
  expect(placeholder).toHaveAttribute('aria-hidden', 'true')
})

it('shows the saved photo instead of the food icon', () => {
  const { container } = render(<RecipeCardImage recipe={{ image_url: '/media/photo.jpg', recipe_types: ['Beverages'], tags: [] }} />)
  expect(screen.getByAltText('')).toHaveAttribute('src', '/media/photo.jpg')
  expect(container.querySelector('svg')).not.toBeInTheDocument()
})
