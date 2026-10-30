/**
 * FitScan Mobile Reusable UI Primitives Barrel
 * Standardized components adhering to Warm Culinary Palette & WCAG AA accessibility.
 */

import Button from './Button';
import Card from './Card';
import Badge from './Badge';
import TextInputField from './TextInputField';
import ScreenHeader from './ScreenHeader';

// 1. Named exports for destructured consumers:
//    import { Button, Card, Badge, TextInputField, ScreenHeader } from '../components/ui';
export { Button, Card, Badge, TextInputField, ScreenHeader };

// 2. Default export for UI namespace consumers:
//    import UI from '../components/ui';
export default {
  Button,
  Card,
  Badge,
  TextInputField,
  ScreenHeader,
};
