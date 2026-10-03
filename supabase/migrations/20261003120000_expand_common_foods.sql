-- Keep product IDs, nutrition, brands, source metadata and all meal references intact.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE public.products ADD CONSTRAINT products_category_check
CHECK (category IN ('fruits', 'vegetables', 'meats', 'seafood', 'legumes', 'grains', 'eggs', 'dairy', 'nuts_seeds', 'oils_fats', 'other'));

-- Common food notes now include preparation and source; uniqueness must not depend on notes.
DROP INDEX IF EXISTS public.products_unique_common_foods_idx;
CREATE UNIQUE INDEX products_unique_common_foods_idx
ON public.products (user_id, lower(trim(name)), category)
WHERE brand = 'Common foods' AND source_type = 'manual';

-- Exact translations and classifications of existing user-added foods.
UPDATE public.products AS p
SET name = t.english_name, category = t.category
FROM (VALUES
  ('copos de avena finos', 'Fine oat flakes', 'grains'),
  ('frutos bosque frozen', 'Frozen mixed berries', 'fruits'),
  ('kefir vaca', 'Cow''s milk kefir', 'dairy'),
  ('milk whole', 'Whole milk', 'dairy'),
  ('platano', 'Banana', 'fruits'),
  ('plátano', 'Banana', 'fruits'),
  ('queso rallado mozzarella', 'Shredded mozzarella', 'dairy'),
  ('cherries', 'Cherries', 'fruits'),
  ('kiwi', 'Kiwi', 'fruits'),
  ('quark', 'Quark', 'dairy'),
  ('walnuts', 'Walnuts', 'nuts_seeds'),
  ('yogurt', 'Yogurt', 'dairy')
) AS t(original_name, english_name, category)
WHERE lower(trim(p.name)) = t.original_name
  AND p.brand IS DISTINCT FROM 'Common foods'
  AND (p.name IS DISTINCT FROM t.english_name OR p.category IS DISTINCT FROM t.category);

-- Backfill existing accounts. Never replace a matching custom product or its macros.
-- This matches the application's starter list; new accounts are seeded on first use.
INSERT INTO public.products (
  user_id, name, category, calories_per_100g, protein_per_100g,
  carbs_per_100g, fat_per_100g, brand, source_type, notes
)
SELECT u.id, s.name, s.category, s.calories, s.protein, s.carbs, s.fat,
  'Common foods', 'manual', s.notes
FROM auth.users AS u
CROSS JOIN (VALUES
  ('Apple', 'fruits', 52.0, 0.3, 13.8, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Banana', 'fruits', 89.0, 1.1, 22.8, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Orange', 'fruits', 47.0, 0.9, 11.8, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Grapes', 'fruits', 69.0, 0.7, 18.1, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Strawberries', 'fruits', 32.0, 0.7, 7.7, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Blueberries', 'fruits', 57.0, 0.7, 14.5, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Raspberries', 'fruits', 52.0, 1.2, 11.9, 0.7, 'Common raw food nutrition values per 100 g.'),
  ('Blackberries', 'fruits', 43.0, 1.4, 10.2, 0.5, 'Common raw food nutrition values per 100 g.'),
  ('Mango', 'fruits', 60.0, 0.8, 15.0, 0.4, 'Common raw food nutrition values per 100 g.'),
  ('Pineapple', 'fruits', 50.0, 0.5, 13.1, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Watermelon', 'fruits', 30.0, 0.6, 7.6, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Cantaloupe', 'fruits', 34.0, 0.8, 8.2, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Peach', 'fruits', 39.0, 0.9, 9.5, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Pear', 'fruits', 57.0, 0.4, 15.2, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Plum', 'fruits', 46.0, 0.7, 11.4, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Cherries', 'fruits', 63.0, 1.1, 16.0, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Kiwi', 'fruits', 61.0, 1.1, 14.7, 0.5, 'Common raw food nutrition values per 100 g.'),
  ('Lemon', 'fruits', 29.0, 1.1, 9.3, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Lime', 'fruits', 30.0, 0.7, 10.5, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Avocado', 'fruits', 160.0, 2.0, 8.5, 14.7, 'Common raw food nutrition values per 100 g.'),
  ('Carrot', 'vegetables', 41.0, 0.9, 9.6, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Broccoli', 'vegetables', 34.0, 2.8, 6.6, 0.4, 'Common raw food nutrition values per 100 g.'),
  ('Spinach', 'vegetables', 23.0, 2.9, 3.6, 0.4, 'Common raw food nutrition values per 100 g.'),
  ('Romaine lettuce', 'vegetables', 17.0, 1.2, 3.3, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Tomato', 'vegetables', 18.0, 0.9, 3.9, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Cucumber', 'vegetables', 15.0, 0.7, 3.6, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Red bell pepper', 'vegetables', 31.0, 1.0, 6.0, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Onion', 'vegetables', 40.0, 1.1, 9.3, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Garlic', 'vegetables', 149.0, 6.4, 33.1, 0.5, 'Common raw food nutrition values per 100 g.'),
  ('Potato', 'vegetables', 77.0, 2.0, 17.5, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Sweet potato', 'vegetables', 86.0, 1.6, 20.1, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Sweet corn', 'vegetables', 86.0, 3.3, 19.0, 1.4, 'Common raw food nutrition values per 100 g.'),
  ('Green peas', 'vegetables', 81.0, 5.4, 14.5, 0.4, 'Common raw food nutrition values per 100 g.'),
  ('Green beans', 'vegetables', 31.0, 1.8, 7.0, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Cabbage', 'vegetables', 25.0, 1.3, 5.8, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Cauliflower', 'vegetables', 25.0, 1.9, 5.0, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Zucchini', 'vegetables', 17.0, 1.2, 3.1, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('White mushrooms', 'vegetables', 22.0, 3.1, 3.3, 0.3, 'Common raw food nutrition values per 100 g.'),
  ('Asparagus', 'vegetables', 20.0, 2.2, 3.9, 0.1, 'Common raw food nutrition values per 100 g.'),
  ('Celery', 'vegetables', 16.0, 0.7, 3.0, 0.2, 'Common raw food nutrition values per 100 g.'),
  ('Chicken breast (raw, skinless)', 'meats', 120.0, 22.5, 0.0, 2.62, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171077/nutrients'),
  ('Chicken breast (roasted, skinless)', 'meats', 165.0, 31.02, 0.0, 3.57, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171477/nutrients'),
  ('Chicken thigh (raw, skinless)', 'meats', 121.0, 19.66, 0.0, 4.12, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173627/nutrients'),
  ('Chicken thigh (roasted, skinless)', 'meats', 179.0, 24.76, 0.0, 8.15, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172388/nutrients'),
  ('Turkey breast (raw, skinless)', 'meats', 114.0, 23.34, 0.0, 2.33, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/174515/nutrients'),
  ('Ground beef (raw, 5% fat)', 'meats', 137.0, 21.41, 0.0, 5.0, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171790/nutrients'),
  ('Ground beef (raw, 10% fat)', 'meats', 176.0, 20.0, 0.0, 10.0, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/174030/nutrients'),
  ('Pork tenderloin (raw)', 'meats', 109.0, 20.95, 0.0, 2.17, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/168249/nutrients'),
  ('Pork tenderloin (roasted)', 'meats', 143.0, 26.17, 0.0, 3.51, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/168250/nutrients'),
  ('Salmon (raw, farmed Atlantic)', 'seafood', 208.0, 20.42, 0.0, 13.42, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/175167/nutrients'),
  ('Salmon (cooked, farmed Atlantic)', 'seafood', 206.0, 22.1, 0.0, 12.35, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/175168/nutrients'),
  ('Cod (raw)', 'seafood', 82.0, 17.81, 0.0, 0.67, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171955/nutrients'),
  ('Cod (cooked)', 'seafood', 105.0, 22.83, 0.0, 0.86, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171956/nutrients'),
  ('Tuna (canned in water, drained)', 'seafood', 86.0, 19.44, 0.0, 0.96, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173709/nutrients'),
  ('Shrimp (raw)', 'seafood', 85.0, 20.1, 0.0, 0.51, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/175179/nutrients'),
  ('Shrimp (cooked)', 'seafood', 99.0, 23.98, 0.2, 0.28, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/175180/nutrients'),
  ('Lentils (dry)', 'legumes', 352.0, 24.63, 63.35, 1.06, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172420/nutrients'),
  ('Lentils (cooked)', 'legumes', 116.0, 9.02, 20.13, 0.38, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172421/nutrients'),
  ('Red lentils (dry)', 'legumes', 358.0, 23.91, 63.1, 2.17, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/174284/nutrients'),
  ('Chickpeas (dry)', 'legumes', 378.0, 20.47, 62.95, 6.04, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173756/nutrients'),
  ('Chickpeas (cooked)', 'legumes', 164.0, 8.86, 27.42, 2.59, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173757/nutrients'),
  ('Chickpeas (canned, drained)', 'legumes', 139.0, 7.05, 22.53, 2.77, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173800/nutrients'),
  ('Black beans (dry)', 'legumes', 341.0, 21.6, 62.36, 1.42, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173734/nutrients'),
  ('Black beans (cooked)', 'legumes', 132.0, 8.86, 23.71, 0.54, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173735/nutrients'),
  ('Red kidney beans (dry)', 'legumes', 337.0, 22.53, 61.29, 1.06, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173744/nutrients'),
  ('Red kidney beans (cooked)', 'legumes', 127.0, 8.67, 22.8, 0.5, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/175194/nutrients'),
  ('White beans (dry)', 'legumes', 333.0, 23.36, 60.27, 0.85, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/175202/nutrients'),
  ('White beans (cooked)', 'legumes', 139.0, 9.73, 25.09, 0.35, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/175203/nutrients'),
  ('Edamame (cooked)', 'legumes', 121.0, 11.91, 8.91, 5.2, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/168411/nutrients'),
  ('Tofu (firm, calcium-set)', 'legumes', 144.0, 17.27, 2.78, 8.72, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172475/nutrients'),
  ('Tempeh (cooked)', 'legumes', 195.0, 19.91, 7.62, 11.38, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172467/nutrients'),
  ('White rice (dry)', 'grains', 365.0, 7.13, 79.95, 0.66, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169756/nutrients'),
  ('White rice (cooked)', 'grains', 130.0, 2.69, 28.17, 0.28, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169757/nutrients'),
  ('Brown rice (dry)', 'grains', 367.0, 7.54, 76.25, 3.2, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169703/nutrients'),
  ('Brown rice (cooked)', 'grains', 123.0, 2.74, 25.58, 0.97, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169704/nutrients'),
  ('Pasta (dry)', 'grains', 371.0, 13.04, 74.67, 1.51, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/168927/nutrients'),
  ('Pasta (cooked)', 'grains', 158.0, 5.8, 30.86, 0.93, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/168928/nutrients'),
  ('Whole wheat pasta (dry)', 'grains', 352.0, 13.87, 73.37, 2.93, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169738/nutrients'),
  ('Whole wheat pasta (cooked)', 'grains', 149.0, 5.99, 30.07, 1.71, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/168910/nutrients'),
  ('Quinoa (dry)', 'grains', 368.0, 14.12, 64.16, 6.07, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/168874/nutrients'),
  ('Quinoa (cooked)', 'grains', 120.0, 4.4, 21.3, 1.92, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/168917/nutrients'),
  ('Couscous (dry)', 'grains', 376.0, 12.76, 77.43, 0.64, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169699/nutrients'),
  ('Couscous (cooked)', 'grains', 112.0, 3.79, 23.22, 0.16, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169700/nutrients'),
  ('Bulgur (dry)', 'grains', 342.0, 12.29, 75.87, 1.33, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170688/nutrients'),
  ('Bulgur (cooked)', 'grains', 83.0, 3.08, 18.58, 0.24, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170287/nutrients'),
  ('Rolled oats (dry)', 'grains', 379.0, 13.15, 67.7, 6.52, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173904/nutrients'),
  ('Whole wheat bread', 'grains', 252.0, 12.45, 42.71, 3.5, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172688/nutrients'),
  ('White bread', 'grains', 266.0, 8.85, 49.42, 3.33, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/174924/nutrients'),
  ('Whole egg (raw)', 'eggs', 143.0, 12.56, 0.72, 9.51, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171287/nutrients'),
  ('Egg whites (raw)', 'eggs', 52.0, 10.9, 0.73, 0.17, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172183/nutrients'),
  ('Whole egg (hard boiled)', 'eggs', 155.0, 12.58, 1.12, 10.61, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173424/nutrients'),
  ('Whole milk', 'dairy', 61.0, 3.15, 4.8, 3.25, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171265/nutrients'),
  ('Milk (2% fat)', 'dairy', 50.0, 3.3, 4.8, 1.98, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171267/nutrients'),
  ('Skim milk', 'dairy', 34.0, 3.37, 4.96, 0.08, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171269/nutrients'),
  ('Plain yogurt (whole milk)', 'dairy', 61.0, 3.47, 4.66, 3.25, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171284/nutrients'),
  ('Greek yogurt (plain, nonfat)', 'dairy', 59.0, 10.19, 3.6, 0.39, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170894/nutrients'),
  ('Greek yogurt (plain, whole milk)', 'dairy', 97.0, 9.0, 3.98, 5.0, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171304/nutrients'),
  ('Cottage cheese (2% fat)', 'dairy', 81.0, 10.45, 4.76, 2.27, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172182/nutrients'),
  ('Mozzarella (whole milk)', 'dairy', 299.0, 22.17, 2.4, 22.14, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170845/nutrients'),
  ('Cheddar', 'dairy', 403.0, 22.87, 3.37, 33.31, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173414/nutrients'),
  ('Parmesan', 'dairy', 392.0, 35.75, 3.22, 25.0, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170848/nutrients'),
  ('Almonds (raw)', 'nuts_seeds', 579.0, 21.15, 21.55, 49.93, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170567/nutrients'),
  ('Walnuts (raw)', 'nuts_seeds', 654.0, 15.23, 13.71, 65.21, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170187/nutrients'),
  ('Cashews (raw)', 'nuts_seeds', 553.0, 18.22, 30.19, 43.85, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170162/nutrients'),
  ('Chia seeds (dried)', 'nuts_seeds', 486.0, 16.54, 42.12, 30.74, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170554/nutrients'),
  ('Flaxseed', 'nuts_seeds', 534.0, 18.29, 28.88, 42.16, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169414/nutrients'),
  ('Pumpkin seeds (dried, shelled)', 'nuts_seeds', 559.0, 30.23, 10.71, 49.05, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170556/nutrients'),
  ('Sunflower seeds (dried, shelled)', 'nuts_seeds', 584.0, 20.78, 20.0, 51.46, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/170562/nutrients'),
  ('Peanut butter (smooth, unsalted)', 'nuts_seeds', 598.0, 22.21, 22.31, 51.36, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/172470/nutrients'),
  ('Olive oil', 'oils_fats', 884.0, 0.0, 0.0, 100.0, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171413/nutrients'),
  ('Sunflower oil', 'oils_fats', 884.0, 0.0, 0.0, 100.0, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/171025/nutrients'),
  ('Butter (salted)', 'oils_fats', 717.0, 0.85, 0.06, 81.11, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/173410/nutrients'),
  ('Nectarine', 'fruits', 44.0, 1.06, 10.55, 0.32, 'Generic nutrition per 100 g of edible food in the stated preparation. USDA FoodData Central (SR Legacy): https://fdc.nal.usda.gov/food-details/169914/nutrients')
) AS s(name, category, calories, protein, carbs, fat, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.user_id = u.id AND lower(trim(p.name)) = lower(trim(s.name)) AND p.category = s.category
)
ON CONFLICT DO NOTHING;
