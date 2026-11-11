import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';

import { colors, typography, spacing, radius, shadows } from '../theme';
import { Button, Card, Badge, ScreenHeader } from '../components/ui';
import { getSettings } from '../services/api';

// --- Semantic Vector SVG Icons (Zero Raw Emojis) ---
function SparkleIcon({ size = 16, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
        fill={color}
      />
    </Svg>
  );
}

function PillIcon({ size = 16, color = '#38BDF8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.5 20.5l10-10a4.95 4.95 0 10-7-7l-10 10a4.95 4.95 0 107 7zM8.5 8.5l7 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DumbbellIcon({ size = 16, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 6.5h11M6.5 17.5h11M4 9.5v5M20 9.5v5M2 11v2M22 11v2M6.5 6.5v11M17.5 6.5v11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SnackIcon({ size = 16, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2a10 10 0 1010 10 3.5 3.5 0 01-3.5-3.5 3.5 3.5 0 01-3.5-3.5A3.5 3.5 0 0112 2zM8.5 8.5h.01M7 13h.01M12 16h.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CartIcon({ size = 20, color = '#F8FAFC' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2L3 6v14a2 2 0 002 2h12a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SearchIcon({ size = 18, color = '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" />
      <Path
        d="M21 21l-4.35-4.35"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ size = 16, color = '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TargetIcon({ size = 14, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}

function CheckIcon({ size = 14, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function BoltIcon({ size = 16, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DropIcon({ size = 16, color = '#38BDF8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ActivityIcon({ size = 16, color = '#A855F7' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 12h-4l-3 9L9 3l-3 9H2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ScaleIcon({ size = 16, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v18M6 8l6-5 6 5M6 8l-4 8h8l-4-8zM18 8l-4 8h8l-4-8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LeafIcon({ size = 16, color = '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 20A7 7 0 014 13C4 7 11 2 20 2c0 9-5 16-11 16zM2 22l7-7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function JarIcon({ size = 16, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 8h14v12a2 2 0 01-2 2H7a2 2 0 01-2-2V8zM8 4h8v4H8V4z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function renderProductIcon(productId, size = 20) {
  switch (productId) {
    case 'p1':
      return <JarIcon size={size} color="#F59E0B" />;
    case 'p2':
      return <BoltIcon size={size} color="#F59E0B" />;
    case 'p3':
      return <PillIcon size={size} color="#38BDF8" />;
    case 'p4':
      return <DropIcon size={size} color="#38BDF8" />;
    case 'p5':
      return <ActivityIcon size={size} color="#A855F7" />;
    case 'p6':
      return <DumbbellIcon size={size} color="#F59E0B" />;
    case 'p7':
      return <ScaleIcon size={size} color="#10B981" />;
    case 'p8':
      return <ActivityIcon size={size} color="#A855F7" />;
    case 'p9':
      return <SnackIcon size={size} color="#F59E0B" />;
    case 'p10':
      return <LeafIcon size={size} color="#10B981" />;
    default:
      return <SparkleIcon size={size} color="#F59E0B" />;
  }
}

function StarIcon({ size = 11, color = '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </Svg>
  );
}

/**
 * Filter Categories for Store
 */
const CATEGORIES = [
  { id: 'all', label: 'All', icon: <SparkleIcon size={14} color="#F59E0B" /> },
  { id: 'supplements', label: 'Supplements', icon: <PillIcon size={14} color="#38BDF8" /> },
  { id: 'equipment', label: 'Equipment', icon: <DumbbellIcon size={14} color="#F59E0B" /> },
  { id: 'snacks', label: 'Snacks', icon: <SnackIcon size={14} color="#10B981" /> },
];

/**
 * Goal Recommendation Metadata Mapping
 */
const GOAL_RECOMMENDATIONS = {
  muscle_building: {
    title: 'Recommended for Muscle Building',
    tagline: 'Surplus protein & power recovery to maximize lean hypertrophy',
    highlightedProductId: 'p1',
    accentVariant: 'protein',
  },
  fat_loss: {
    title: 'Recommended for Fat Loss',
    tagline: 'Electrolyte hydration & metabolic resistance gear for caloric deficit',
    highlightedProductId: 'p4',
    accentVariant: 'warning',
  },
  weight_loss: {
    title: 'Recommended for Weight Loss',
    tagline: 'Smart body composition tracking & guilt-free high-protein snacks',
    highlightedProductId: 'p7',
    accentVariant: 'primary',
  },
  muscle_maintain: {
    title: 'Recommended for Maintenance',
    tagline: 'Daily micronutrients & myofascial foam roller for active recovery',
    highlightedProductId: 'p3',
    accentVariant: 'info',
  },
};

/**
 * Curated Product Catalog
 */
const PRODUCTS = [
  {
    id: 'p1',
    name: '100% Whey Protein Isolate (2kg)',
    brand: 'NutraPeak',
    category: 'supplements',
    price: 2999,
    originalPrice: 3599,
    rating: 4.9,
    reviewsCount: 1240,
    icon: 'p1',
    badgeText: '27g Protein/scoop',
    badgeVariant: 'protein',
    goalTypes: ['muscle_building', 'fat_loss'],
    shortDesc: 'Ultra-pure microfiltered whey isolate with 27g protein, 5.8g BCAAs, and zero added sugars.',
    details: {
      servings: '66 servings',
      flavor: 'Double Rich Chocolate',
      benefits: [
        'Promotes rapid muscle protein synthesis post-workout',
        'Microfiltered for ultra-low lactose and rapid digestion',
        'Zero aspartame and clean natural stevia sweetening',
      ],
      specs: [
        { label: 'Protein / Serving', value: '27g' },
        { label: 'BCAAs', value: '5.8g' },
        { label: 'Carbs / Sugar', value: '1.2g / 0g' },
        { label: 'Fat', value: '0.5g' },
      ],
    },
  },
  {
    id: 'p2',
    name: 'Creapure Micronized Creatine (250g)',
    brand: 'PurePower',
    category: 'supplements',
    price: 999,
    originalPrice: 1299,
    rating: 4.8,
    reviewsCount: 850,
    icon: 'p2',
    badgeText: 'Peak Strength',
    badgeVariant: 'primary',
    goalTypes: ['muscle_building'],
    shortDesc: '100% Creapure German micronized creatine monohydrate to boost ATP energy and power output.',
    details: {
      servings: '83 servings (3g scoop)',
      flavor: 'Unflavored (100% Pure)',
      benefits: [
        'Increases high-intensity muscular power and sprint speed',
        'Enhances intra-cellular water retention in muscle fibers',
        'Ultra-fine 200 mesh powder for rapid dissolving',
      ],
      specs: [
        { label: 'Creatine Monohydrate', value: '3,000mg' },
        { label: 'Purity Standard', value: '99.9% Creapure' },
        { label: 'Calories', value: '0 kcal' },
      ],
    },
  },
  {
    id: 'p3',
    name: 'Complete Daily Multivitamin & Minerals (60 tabs)',
    brand: 'VitalLife',
    category: 'supplements',
    price: 649,
    originalPrice: 849,
    rating: 4.7,
    reviewsCount: 620,
    icon: 'p3',
    badgeText: '23 Micronutrients',
    badgeVariant: 'info',
    goalTypes: ['muscle_maintain', 'fat_loss', 'weight_loss'],
    shortDesc: 'High-potency multivitamin complex with bioavailable Zinc, Magnesium, Vitamin D3, and B-Complex.',
    details: {
      servings: '60 daily coated tablets',
      flavor: 'Coated Tablets',
      benefits: [
        'Fills essential micronutrient gaps during intense diet deficits',
        'Supports immune defenses, bone density, and energy metabolism',
        'Formulated with Bioperine for enhanced absorption',
      ],
      specs: [
        { label: 'Vitamins & Minerals', value: '23 Essential' },
        { label: 'Vitamin D3', value: '2000 IU (250% RDA)' },
        { label: 'Zinc & Magnesium', value: 'Zinc 15mg / Mag 200mg' },
      ],
    },
  },
  {
    id: 'p4',
    name: 'Electrolyte Hydration Complex (30 sachets)',
    brand: 'HydroFit',
    category: 'supplements',
    price: 799,
    originalPrice: 999,
    rating: 4.8,
    reviewsCount: 410,
    icon: 'p4',
    badgeText: 'Zero Sugar',
    badgeVariant: 'warning',
    goalTypes: ['fat_loss', 'weight_loss'],
    shortDesc: 'Scientific electrolyte balance of sodium, potassium, and magnesium to prevent fatigue and cramps.',
    details: {
      servings: '30 single-serve sachets',
      flavor: 'Zesty Lemon Lime',
      benefits: [
        'Rapid cellular rehydration during cardio and heavy sweat',
        'Zero sugar, zero carbs, keto and fasting friendly',
        'Eliminates fatigue, brain fog, and headaches on caloric deficit',
      ],
      specs: [
        { label: 'Sodium', value: '500mg' },
        { label: 'Potassium', value: '200mg' },
        { label: 'Magnesium', value: '60mg' },
        { label: 'Sugar', value: '0g' },
      ],
    },
  },
  {
    id: 'p5',
    name: 'Heavy-Duty Resistance Loop Bands (5-Pack)',
    brand: 'FlexPro',
    category: 'equipment',
    price: 899,
    originalPrice: 1299,
    rating: 4.9,
    reviewsCount: 2100,
    icon: 'p5',
    badgeText: '10–50 lbs Range',
    badgeVariant: 'primary',
    goalTypes: ['fat_loss', 'muscle_maintain', 'muscle_building'],
    shortDesc: '100% natural Malaysian latex bands with 5 color-coded resistance levels for home or travel workouts.',
    details: {
      servings: 'Set of 5 loop bands + waterproof pouch',
      flavor: '5 Progressive Tensions',
      benefits: [
        'Target glutes, shoulders, hamstrings, and mobility drills',
        'Skin-friendly anti-snap Malaysian natural latex',
        'Includes portable pouch and illustrated exercise guide',
      ],
      specs: [
        { label: 'Material', value: '100% Natural Latex' },
        { label: 'Resistance Tiers', value: '10, 15, 20, 30, 50 lbs' },
        { label: 'Dimensions', value: '300mm x 50mm' },
      ],
    },
  },
  {
    id: 'p6',
    name: 'Adjustable Quick-Select Dumbbell (2.5 – 24kg)',
    brand: 'IronGrip',
    category: 'equipment',
    price: 8499,
    originalPrice: 11999,
    rating: 4.9,
    reviewsCount: 780,
    icon: 'p6',
    badgeText: '15 Weights in 1',
    badgeVariant: 'primary',
    goalTypes: ['muscle_building', 'muscle_maintain'],
    shortDesc: 'Smooth dial selection mechanism that switches weight from 2.5kg up to 24kg in 15 progressive increments.',
    details: {
      servings: 'Single adjustable dumbbell with custom dock',
      flavor: 'Laser-Etched Steel',
      benefits: [
        'Replaces 15 pairs of traditional dumbbells in a single unit',
        'Heavy-duty laser-cut steel plates with silent polymer molding',
        'Ergonomic knurled anti-slip handle with safety locking latch',
      ],
      specs: [
        { label: 'Weight Range', value: '2.5kg to 24kg' },
        { label: 'Increments', value: '15 distinct settings' },
        { label: 'Dimensions', value: '40 x 20 x 23 cm' },
      ],
    },
  },
  {
    id: 'p7',
    name: 'Smart Bluetooth Body Composition Scale',
    brand: 'CoreControl Pro',
    category: 'equipment',
    price: 1899,
    originalPrice: 2499,
    rating: 4.8,
    reviewsCount: 1420,
    icon: 'p7',
    badgeText: 'CoreControl Sync',
    badgeVariant: 'success',
    goalTypes: ['weight_loss', 'fat_loss', 'muscle_maintain'],
    shortDesc: 'High-precision ITO glass sensors measuring weight, body fat %, skeletal muscle, BMI, and visceral fat.',
    details: {
      servings: 'Scale + 4x AAA Batteries included',
      flavor: 'Tempered ITO Glass',
      benefits: [
        'Direct Bluetooth sync with CoreControl',
        'Measures 13 comprehensive physical health metrics',
        'Multi-user auto detection for up to 8 family members',
      ],
      specs: [
        { label: 'Sensors', value: '4 High-Precision ITO Electrodes' },
        { label: 'Capacity', value: '0.2kg - 180kg' },
        { label: 'Connectivity', value: 'Bluetooth 5.2 Low Energy' },
      ],
    },
  },
  {
    id: 'p8',
    name: 'High-Density Muscle Recovery Foam Roller (45cm)',
    brand: 'Recovr',
    category: 'equipment',
    price: 749,
    originalPrice: 999,
    rating: 4.7,
    reviewsCount: 530,
    icon: 'p8',
    badgeText: 'Deep Tissue',
    badgeVariant: 'neutral',
    goalTypes: ['muscle_maintain', 'muscle_building'],
    shortDesc: 'Multi-density 3D trigger-point surface relieves muscle knots, tight IT bands, and improves joint mobility.',
    details: {
      servings: '1x 45cm Textured Foam Roller',
      flavor: 'High-Density EVA Foam',
      benefits: [
        'Accelerates post-workout lactic acid flush and blood circulation',
        'Simulates deep tissue sports massage therapist finger pressure',
        'Lightweight, waterproof, and durable rigid hollow core',
      ],
      specs: [
        { label: 'Dimensions', value: '45cm length x 14cm diameter' },
        { label: 'Weight Limit', value: 'Supports up to 200kg' },
        { label: 'Material', value: 'Eco-Friendly EVA Foam' },
      ],
    },
  },
  {
    id: 'p9',
    name: 'Crispy Whey High-Protein Bars (Box of 6)',
    brand: 'NutraPeak',
    category: 'snacks',
    price: 699,
    originalPrice: 899,
    rating: 4.8,
    reviewsCount: 950,
    icon: 'p9',
    badgeText: '20g Protein / bar',
    badgeVariant: 'protein',
    goalTypes: ['muscle_building', 'fat_loss'],
    shortDesc: 'Crunchy chocolate almond bars loaded with 20g whey protein, 7g dietary fiber, and under 2g sugar.',
    details: {
      servings: 'Box of 6 bars (60g each)',
      flavor: 'Chocolate Almond Crunch',
      benefits: [
        'High-satiety snack that easily suppresses dessert cravings',
        'Slow-digesting prebiotic fibers for healthy gut digestion',
        'Zero added sucrose, zero palm oil, and non-GMO',
      ],
      specs: [
        { label: 'Protein / Bar', value: '20g' },
        { label: 'Calories', value: '210 kcal' },
        { label: 'Net Carbs / Fiber', value: '11g / 7g' },
        { label: 'Sugar', value: '1.8g' },
      ],
    },
  },
  {
    id: 'p10',
    name: 'Spiced Roasted Edamame Crunch (150g)',
    brand: 'GreenBite',
    category: 'snacks',
    price: 349,
    originalPrice: 449,
    rating: 4.6,
    reviewsCount: 340,
    icon: 'p10',
    badgeText: '14g Plant Protein',
    badgeVariant: 'protein',
    goalTypes: ['fat_loss', 'weight_loss', 'muscle_maintain'],
    shortDesc: 'Dry-roasted young edamame beans dusted with pink Himalayan salt and smoked paprika. 100% vegan.',
    details: {
      servings: '3 servings (50g each)',
      flavor: 'Himalayan Pink Salt & Paprika',
      benefits: [
        'Crunchy whole food alternative to processed potato chips',
        'Rich in complete plant protein and gut-friendly dietary fiber',
        'Naturally gluten-free, vegan, and non-GMO verified',
      ],
      specs: [
        { label: 'Plant Protein / 50g', value: '14g' },
        { label: 'Calories / 50g', value: '140 kcal' },
        { label: 'Dietary Fiber', value: '8g' },
        { label: 'Fat', value: '4.5g' },
      ],
    },
  },
];

const CART_STORAGE_KEY = 'fitscan_store_cart';
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function StoreScreen({ navigation, user }) {
  const insets = useSafeAreaInsets();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Cart state: mapping of productId -> quantity
  const [cart, setCart] = useState({});
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Swipe-to-dismiss animation and gesture state for product detail modal
  const modalPanY = useRef(new Animated.Value(0)).current;
  const modalScrollOffset = useRef(0);

  const closeModal = useCallback(() => {
    Animated.timing(modalPanY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setSelectedProduct(null);
      modalPanY.setValue(0);
    });
  }, [modalPanY]);

  const handleOpenProduct = useCallback((product) => {
    modalPanY.setValue(0);
    modalScrollOffset.current = 0;
    setSelectedProduct(product);
  }, [modalPanY]);

  // Dedicated Header PanResponder for 100% reliable drag handle interaction
  const headerPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 4,
      onPanResponderGrant: () => {
        modalPanY.setOffset(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          modalPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || (gestureState.dy > 40 && gestureState.vy > 0.5)) {
          closeModal();
        } else {
          Animated.spring(modalPanY, {
            toValue: 0,
            bounciness: 4,
            speed: 14,
            useNativeDriver: true,
          }).start();
        }
      },
    });
  }, [modalPanY, closeModal]);

  // Content PanResponder: only activates downward drag when scroll view is at top
  const sheetPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          gestureState.dy > 8 &&
          modalScrollOffset.current <= 0 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2
        );
      },
      onPanResponderGrant: () => {
        modalPanY.setOffset(0);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          modalPanY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || (gestureState.dy > 40 && gestureState.vy > 0.5)) {
          closeModal();
        } else {
          Animated.spring(modalPanY, {
            toValue: 0,
            bounciness: 4,
            speed: 14,
            useNativeDriver: true,
          }).start();
        }
      },
    });
  }, [modalPanY, closeModal]);


  // Restore cart & fetch latest user settings on focus
  const loadCart = useCallback(async () => {
    try {
      const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
    } catch (e) {
      console.warn('Failed to load store cart:', e);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const settings = await getSettings();
      if (settings) {
        setUserSettings(settings);
      }
    } catch (e) {
      console.warn('Failed to load settings in Store:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCart();
      loadSettings();
    }, [loadCart, loadSettings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadSettings();
    loadCart();
  };

  // Cart persistence
  const updateCartState = async (newCart) => {
    setCart(newCart);
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
    } catch (e) {
      console.warn('Failed to save cart:', e);
    }
  };

  const handleAddToCart = (product) => {
    const currentQty = cart[product.id] || 0;
    const newCart = {
      ...cart,
      [product.id]: currentQty + 1,
    };
    updateCartState(newCart);
  };

  const handleRemoveFromCart = (productId) => {
    const currentQty = cart[productId] || 0;
    if (currentQty <= 1) {
      const newCart = { ...cart };
      delete newCart[productId];
      updateCartState(newCart);
    } else {
      const newCart = {
        ...cart,
        [productId]: currentQty - 1,
      };
      updateCartState(newCart);
    }
  };

  const totalCartCount = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }, [cart]);

  const cartItemsList = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const prod = PRODUCTS.find((p) => p.id === id);
        return prod ? { ...prod, quantity: qty } : null;
      })
      .filter(Boolean);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cartItemsList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItemsList]);

  // Goal & Recommendation resolution
  const userGoalType = userSettings?.goal_type || user?.goal_type || 'fat_loss';
  const currentRecommendation = GOAL_RECOMMENDATIONS[userGoalType] || GOAL_RECOMMENDATIONS.fat_loss;
  const recommendedProduct = PRODUCTS.find((p) => p.id === currentRecommendation.highlightedProductId);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let list = PRODUCTS;
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.shortDesc.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedCategory, searchQuery]);

  // Checkout simulation
  const handleCheckout = () => {
    Alert.alert(
      'Order Confirmed',
      `Thank you! Your simulated order for ₹${cartSubtotal.toLocaleString('en-IN')} has been placed.\n\nEstimated delivery within 2-3 business days.`,
      [
        {
          text: 'Great',
          onPress: () => {
            updateCartState({});
            setCartModalVisible(false);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      {/* Universal Screen Header */}
      <ScreenHeader
        title="CoreControl Store"
        subtitle="Supplements & Fitness Gear"
        rightAction={
          <TouchableOpacity
            style={styles.cartHeaderButton}
            onPress={() => setCartModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Shopping cart with ${totalCartCount} items`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CartIcon size={22} color={colors.textPrimary || '#F8FAFC'} />
            {totalCartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Search Bar Input */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <SearchIcon size={18} color={colors.textSecondary || '#94A3B8'} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search supplements, equipment, snacks..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
              >
                <CloseIcon size={14} color={colors.textSecondary || '#94A3B8'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category Filter Pills (>=48dp touch region) */}
        <View style={styles.categoriesSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScrollContent}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <View key={cat.id} style={styles.categoryPillWrapper}>
                  <Badge
                    label={cat.label}
                    icon={cat.icon}
                    variant={isSelected ? 'primary' : 'neutral'}
                    size="lg"
                    selected={isSelected}
                    onPress={() => setSelectedCategory(cat.id)}
                    accessibilityLabel={`Filter by ${cat.label}`}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Contextual Goal Recommendation Banner */}
        {selectedCategory === 'all' && searchQuery.trim().length === 0 && (
          <View style={styles.bannerSection}>
            <Card variant="highlight" style={styles.recommendationCard}>
              <View style={styles.recommendationHeader}>
                <View style={styles.recommendationHeaderLeft}>
                  <Badge
                    label="Goal Match"
                    variant={currentRecommendation.accentVariant}
                    size="sm"
                    icon={<TargetIcon size={12} color="#F59E0B" />}
                  />
                  <Text style={styles.goalPillText}>
                    {userGoalType.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                {recommendedProduct && (
                  <Text style={styles.discountBadge}>SAVE ₹{recommendedProduct.originalPrice - recommendedProduct.price}</Text>
                )}
              </View>

              <Text style={styles.recommendationTitle}>
                {currentRecommendation.title}
              </Text>
              <Text style={styles.recommendationTagline}>
                {currentRecommendation.tagline}
              </Text>

              {recommendedProduct && (
                <View style={styles.featuredProductRow}>
                  <View style={styles.featuredIconBox}>
                    {renderProductIcon(recommendedProduct.id, 24)}
                  </View>
                  <View style={styles.featuredProductInfo}>
                    <Text style={styles.featuredProductName} numberOfLines={1}>
                      {recommendedProduct.name}
                    </Text>
                    <View style={styles.featuredPriceRow}>
                      <Text style={styles.featuredPrice}>
                        ₹{recommendedProduct.price.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.featuredOriginalPrice}>
                        ₹{recommendedProduct.originalPrice.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                  <Button
                    title="View"
                    size="sm"
                    variant="outline"
                    onPress={() => handleOpenProduct(recommendedProduct)}
                  />
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Product Catalog Grid */}
        <View style={styles.catalogSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === 'all'
                ? 'Curated Catalog'
                : `${CATEGORIES.find((c) => c.id === selectedCategory)?.label || 'Products'}`}
            </Text>
            <Text style={styles.resultsCount}>
              {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {filteredProducts.length === 0 ? (
            <Card variant="flat" style={styles.emptyCard}>
              <SearchIcon size={36} color={colors.textSecondary || '#94A3B8'} />
              <Text style={styles.emptyTitle}>No matching products</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search query or switching to another category.
              </Text>
              <Button
                title="Reset Filters"
                size="sm"
                variant="outline"
                style={styles.resetBtn}
                onPress={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                }}
              />
            </Card>
          ) : (
            filteredProducts.map((product) => {
              const cartQty = cart[product.id] || 0;
              const isGoalMatch = product.goalTypes?.includes(userGoalType);

              return (
                <Card
                  key={product.id}
                  variant="default"
                  style={styles.productCard}
                  onPress={() => handleOpenProduct(product)}
                  accessibilityLabel={`${product.name}, ${product.brand}, ₹${product.price}`}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.iconBox}>
                      {renderProductIcon(product.id, 22)}
                    </View>
                    <View style={styles.headerInfo}>
                      <View style={styles.brandRow}>
                        <Text style={styles.brandText}>{product.brand}</Text>
                        {isGoalMatch && (
                          <Badge label="Match" variant="primary" size="sm" icon={<TargetIcon size={11} color="#F59E0B" />} />
                        )}
                      </View>
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.shortDesc} numberOfLines={2}>
                    {product.shortDesc}
                  </Text>

                  <View style={styles.specsRow}>
                    <Badge
                      label={product.badgeText}
                      variant={product.badgeVariant}
                      size="sm"
                    />
                    <View style={styles.ratingBadge}>
                      <StarIcon size={10} color="#F59E0B" />
                      <Text style={styles.ratingText}>
                        {product.rating} ({product.reviewsCount})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.priceContainer}>
                      <View style={styles.priceRow}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <Text style={styles.priceAmount}>
                          {product.price.toLocaleString('en-IN')}
                        </Text>
                      </View>
                      {product.originalPrice && (
                        <Text style={styles.originalPrice}>
                          ₹{product.originalPrice.toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>

                    <View style={styles.actionButtonsRow}>
                      <Button
                        title="Details"
                        size="sm"
                        variant="secondary"
                        onPress={() => handleOpenProduct(product)}
                        style={styles.detailsBtn}
                      />
                      <Button
                        title={cartQty > 0 ? `In Cart (${cartQty})` : 'Add'}
                        size="sm"
                        variant={cartQty > 0 ? 'outline' : 'primary'}
                        icon={cartQty > 0 ? <CheckIcon size={13} color="#10B981" /> : undefined}
                        onPress={() => handleAddToCart(product)}
                        style={styles.addBtn}
                      />
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Product Detail Modal with Swipe-to-Dismiss */}
      <Modal
        visible={Boolean(selectedProduct)}
        animationType="none"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlayContainer}>
          {/* Animated Backdrop with tap-to-dismiss */}
          <Animated.View
            style={[
              styles.modalBackdrop,
              {
                opacity: modalPanY.interpolate({
                  inputRange: [0, 300],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={closeModal}
              activeOpacity={1}
              accessibilityLabel="Close product details backdrop"
            />
          </Animated.View>

          {/* Animated Modal Bottom Sheet with dual-zone drag */}
          <Animated.View
            style={[
              styles.modalSheet,
              {
                transform: [
                  {
                    translateY: modalPanY.interpolate({
                      inputRange: [-50, 0, SCREEN_HEIGHT],
                      outputRange: [0, 0, SCREEN_HEIGHT],
                    }),
                  },
                ],
              },
            ]}
            {...sheetPanResponder.panHandlers}
          >
            {/* Draggable Header Handle Zone */}
            <View style={styles.modalHeaderRow} {...headerPanResponder.panHandlers}>
              <View style={styles.dragIndicatorWrapper}>
                <View style={styles.dragIndicator} />
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={closeModal}
                accessibilityRole="button"
                accessibilityLabel="Close product details"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <CloseIcon size={16} color={colors.textSecondary || '#94A3B8'} />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={(e) => {
                  modalScrollOffset.current = e.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              >
                <View style={styles.modalTopRow}>
                  <View style={styles.modalIconBox}>
                    {renderProductIcon(selectedProduct.id, 28)}
                  </View>
                  <View style={styles.modalMetaBox}>
                    <Text style={styles.modalBrandText}>{selectedProduct.brand}</Text>
                    <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                    <View style={styles.modalBadgesRow}>
                      <Badge
                        label={selectedProduct.badgeText}
                        variant={selectedProduct.badgeVariant}
                        size="sm"
                      />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <StarIcon size={12} color="#F59E0B" />
                        <Text style={styles.modalRatingText}>
                          {selectedProduct.rating} ({selectedProduct.reviewsCount} verified reviews)
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Price Display */}
                <View style={styles.modalPriceContainer}>
                  <View style={styles.priceRow}>
                    <Text style={styles.modalCurrency}>₹</Text>
                    <Text style={styles.modalPrice}>
                      {selectedProduct.price.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  {selectedProduct.originalPrice && (
                    <View style={styles.modalDiscountRow}>
                      <Text style={styles.modalOriginalPrice}>
                        MRP ₹{selectedProduct.originalPrice.toLocaleString('en-IN')}
                      </Text>
                      <Badge
                        label={`Save ₹${selectedProduct.originalPrice - selectedProduct.price}`}
                        variant="primary"
                        size="sm"
                      />
                    </View>
                  )}
                </View>

                {/* Detailed Description */}
                <Text style={styles.modalShortDesc}>{selectedProduct.shortDesc}</Text>

                {/* Key Benefits */}
                <View style={styles.detailsBlock}>
                  <Text style={styles.detailsBlockTitle}>Key Benefits & Formulation</Text>
                  {selectedProduct.details?.benefits?.map((benefit, index) => (
                    <View key={index} style={styles.benefitRow}>
                      <CheckIcon size={13} color="#10B981" />
                      <Text style={styles.benefitText}>{benefit}</Text>
                    </View>
                  ))}
                </View>

                {/* Technical / Nutritional Specs */}
                <View style={styles.detailsBlock}>
                  <Text style={styles.detailsBlockTitle}>Specifications & Nutrition</Text>
                  <View style={styles.specsTable}>
                    {selectedProduct.details?.specs?.map((spec, index) => (
                      <View
                        key={index}
                        style={[
                          styles.specsTableRow,
                          index % 2 === 0 && styles.specsTableRowEven,
                        ]}
                      >
                        <Text style={styles.specLabel}>{spec.label}</Text>
                        <Text style={styles.specValue}>{spec.value}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Modal CTA Button */}
                <View style={styles.modalActionWrapper}>
                  <Button
                    title={`Add to Cart • ₹${selectedProduct.price.toLocaleString('en-IN')}`}
                    size="lg"
                    fullWidth
                    onPress={() => {
                      handleAddToCart(selectedProduct);
                      closeModal();
                    }}
                  />
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Cart Modal */}
      <Modal
        visible={cartModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.cartHeaderRow}>
              <Text style={styles.cartSheetTitle}>
                Your Cart ({totalCartCount})
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setCartModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close shopping cart"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <CloseIcon size={16} color={colors.textSecondary || '#94A3B8'} />
              </TouchableOpacity>
            </View>

            {cartItemsList.length === 0 ? (
              <View style={styles.emptyCartBox}>
                <CartIcon size={40} color={colors.textSecondary || '#94A3B8'} />
                <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
                <Text style={styles.emptyCartSubtitle}>
                  Browse our curated supplements and fitness gear to add items to your cart.
                </Text>
                <Button
                  title="Explore Store"
                  size="md"
                  variant="primary"
                  onPress={() => setCartModalVisible(false)}
                />
              </View>
            ) : (
              <ScrollView
                style={styles.cartList}
                contentContainerStyle={styles.cartListContent}
                showsVerticalScrollIndicator={false}
              >
                {cartItemsList.map((item) => (
                  <View key={item.id} style={styles.cartItemRow}>
                    <View style={styles.cartItemIconBox}>
                      {renderProductIcon(item.id, 20)}
                    </View>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        ₹{item.price.toLocaleString('en-IN')}
                      </Text>
                    </View>

                    {/* Quantity Selector (>=48dp touch region) */}
                    <View style={styles.quantityControl}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleRemoveFromCart(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease quantity for ${item.name}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => handleAddToCart(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase quantity for ${item.name}`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* Subtotal & Free Delivery Banner */}
                <Card variant="default" style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>
                      ₹{cartSubtotal.toLocaleString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Estimated Shipping</Text>
                    <Text style={styles.freeShippingText}>
                      {cartSubtotal >= 999 ? 'FREE' : '₹99'}
                    </Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryRow}>
                    <Text style={styles.totalLabel}>Total Due</Text>
                    <Text style={styles.totalValue}>
                      ₹{(cartSubtotal >= 999 ? cartSubtotal : cartSubtotal + 99).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </Card>

                <View style={styles.checkoutBtnContainer}>
                  <Button
                    title={`Proceed to Checkout • ₹${(cartSubtotal >= 999 ? cartSubtotal : cartSubtotal + 99).toLocaleString('en-IN')}`}
                    size="lg"
                    fullWidth
                    onPress={handleCheckout}
                  />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background || '#08090C',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // Cart Header Button
  cartHeaderButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartIcon: {
    fontSize: 22,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.primary || '#E8A020',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: colors.textOnPrimary || '#221803',
    fontSize: 11,
    fontWeight: '700',
  },

  // Search Section
  searchSection: {
    paddingHorizontal: spacing.screenPadding || 16,
    paddingTop: spacing.md || 12,
    paddingBottom: spacing.sm || 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    borderRadius: radius.md || 10,
    paddingHorizontal: 12,
    minHeight: 48, // Guaranteed touch accessibility
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary || '#F4ECDD',
    fontSize: typography?.sizes?.base || 14,
    paddingVertical: 10,
  },
  clearSearchBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    color: colors.textSecondary || '#A79A85',
    fontSize: 16,
    fontWeight: '700',
  },

  // Category Pills
  categoriesSection: {
    paddingVertical: spacing.sm || 8,
  },
  categoriesScrollContent: {
    paddingHorizontal: spacing.screenPadding || 16,
    gap: 8,
  },
  categoryPillWrapper: {
    paddingVertical: 4,
  },

  // Contextual Goal Banner
  bannerSection: {
    paddingHorizontal: spacing.screenPadding || 16,
    paddingVertical: spacing.sm || 8,
  },
  recommendationCard: {
    backgroundColor: colors.surface || '#221D17',
    borderWidth: 1.5,
    borderColor: colors.primaryBorder || 'rgba(232, 160, 32, 0.35)',
    padding: spacing.cardPadding || 16,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recommendationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
    letterSpacing: 0.5,
  },
  discountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
    backgroundColor: colors.primarySubtle || 'rgba(232, 160, 32, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full || 999,
  },
  recommendationTitle: {
    fontSize: typography?.sizes?.md || 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 4,
  },
  recommendationTagline: {
    fontSize: typography?.sizes?.sm || 13,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 18,
    marginBottom: 12,
  },
  featuredProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    padding: 10,
    gap: 10,
  },
  featuredIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm || 8,
    backgroundColor: colors.surfaceActive || '#2A2219',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredIcon: {
    fontSize: 20,
  },
  featuredProductInfo: {
    flex: 1,
  },
  featuredProductName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 2,
  },
  featuredPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuredPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  featuredOriginalPrice: {
    fontSize: 11,
    color: colors.textTertiary || '#706555',
    textDecorationLine: 'line-through',
  },

  // Catalog Section
  catalogSection: {
    paddingHorizontal: spacing.screenPadding || 16,
    paddingTop: spacing.md || 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: typography?.sizes?.md || 17,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary || '#A79A85',
  },

  // Empty State
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.surface || '#221D17',
    borderRadius: radius.lg || 16,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary || '#A79A85',
    textAlign: 'center',
    marginBottom: 16,
  },
  resetBtn: {
    minWidth: 120,
  },

  // Product Card
  productCard: {
    marginBottom: 12,
    padding: spacing.cardPadding || 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.md || 10,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  headerInfo: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary || '#A79A85',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    fontSize: typography?.sizes?.base || 15,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    lineHeight: 20,
  },
  shortDesc: {
    fontSize: typography?.sizes?.sm || 13,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 18,
    marginBottom: 10,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary || '#E8A020',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || '#2D261F',
  },
  priceContainer: {
    flexDirection: 'column',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currencySymbol: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
    marginRight: 2,
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  originalPrice: {
    fontSize: 11,
    color: colors.textTertiary || '#706555',
    textDecorationLine: 'line-through',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailsBtn: {
    minHeight: 40,
  },
  addBtn: {
    minHeight: 40,
  },

  // Modal Overlay & Sheet
  modalOverlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceOverlay || 'rgba(0, 0, 0, 0.80)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.surfaceOverlay || 'rgba(0, 0, 0, 0.80)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface || '#221D17',
    borderTopLeftRadius: radius.xl || 20,
    borderTopRightRadius: radius.xl || 20,
    maxHeight: '90%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    ...(shadows.lg || {}),
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  dragIndicatorWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 32, // balances close button on right
  },
  dragIndicator: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.borderHover || '#4A3F34',
    alignSelf: 'center',
  },
  modalCloseBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textSecondary || '#A79A85',
  },

  // Product Detail Modal Content
  modalScrollView: {
    paddingHorizontal: spacing.screenPadding || 16,
  },
  modalScrollContent: {
    paddingBottom: 32,
  },
  modalTopRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: radius.lg || 16,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderWidth: 1,
    borderColor: colors.borderSubtle || '#2D261F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconText: {
    fontSize: 32,
  },
  modalMetaBox: {
    flex: 1,
  },
  modalBrandText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  modalProductName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 6,
  },
  modalBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  modalRatingText: {
    fontSize: 12,
    color: colors.textSecondary || '#A79A85',
  },

  modalPriceContainer: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    padding: 12,
    marginBottom: 16,
  },
  modalCurrency: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
    marginRight: 2,
  },
  modalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  modalDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  modalOriginalPrice: {
    fontSize: 13,
    color: colors.textTertiary || '#706555',
    textDecorationLine: 'line-through',
  },
  modalShortDesc: {
    fontSize: 14,
    color: colors.textPrimary || '#F4ECDD',
    lineHeight: 20,
    marginBottom: 16,
  },

  detailsBlock: {
    marginBottom: 16,
  },
  detailsBlockTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.protein || '#7BA05B',
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary || '#A79A85',
    lineHeight: 18,
  },

  specsTable: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    overflow: 'hidden',
  },
  specsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  specsTableRowEven: {
    backgroundColor: colors.surfaceActive || '#2A2219',
  },
  specLabel: {
    fontSize: 13,
    color: colors.textSecondary || '#A79A85',
  },
  specValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
  },
  modalActionWrapper: {
    marginTop: 8,
  },

  // Cart Modal Content
  cartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle || '#2D261F',
  },
  cartSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyCartIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 6,
  },
  emptyCartSubtitle: {
    fontSize: 14,
    color: colors.textSecondary || '#A79A85',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  cartList: {
    paddingHorizontal: 16,
  },
  cartListContent: {
    paddingVertical: 12,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle || '#2D261F',
    gap: 12,
  },
  cartItemIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md || 10,
    backgroundColor: colors.surfaceElevated || '#2C251D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemIcon: {
    fontSize: 22,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 2,
  },
  cartItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
  },
  qtyBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
    minWidth: 20,
    textAlign: 'center',
  },
  summaryCard: {
    marginTop: 16,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary || '#A79A85',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
  },
  freeShippingText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.protein || '#7BA05B',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.borderSubtle || '#2D261F',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary || '#F4ECDD',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary || '#E8A020',
  },
  checkoutBtnContainer: {
    marginTop: 16,
    marginBottom: 24,
  },
});
