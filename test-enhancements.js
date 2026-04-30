// Quick test to verify enhancements work
import { generateFallbackLabel } from './utils/domUtils.js';

console.log('\n=== Testing generateFallbackLabel Enhancement ===\n');

// Test 1: Element with placeholder (should return placeholder)
const test1 = document.createElement('input');
test1.setAttribute('placeholder', 'Enter name');
test1.setAttribute('name', 'full_name');
console.log('Test 1 (placeholder):', generateFallbackLabel(test1));
// Expected: "Enter name"

// Test 2: Element with name, no placeholder (should return formatted name)
const test2 = document.createElement('input');
test2.setAttribute('name', 'email_address');
console.log('Test 2 (name):', generateFallbackLabel(test2));
// Expected: "email address"

// Test 3: Checkbox with adjacent span text (should return span text)
const container3 = document.createElement('div');
const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
const label_text = document.createElement('span');
label_text.textContent = 'I agree to the terms';
container3.appendChild(checkbox);
container3.appendChild(label_text);
document.body.appendChild(container3);
console.log('Test 3 (sibling span):', generateFallbackLabel(checkbox));
// Expected: "I agree to the terms"

// Test 4: Input with sibling text node (should return text)
const container4 = document.createElement('div');
const input4 = document.createElement('input');
input4.type = 'text';
container4.appendChild(input4);
container4.appendChild(document.createTextNode('  Username field  '));
document.body.appendChild(container4);
console.log('Test 4 (sibling text node):', generateFallbackLabel(input4));
// Expected: "Username field"

// Test 5: Input with no useful fallback (should return "Input field")
const test5 = document.createElement('input');
console.log('Test 5 (generic fallback):', generateFallbackLabel(test5));
// Expected: "Input field"

// Test 6: Input with icon sibling (should skip icon and find text)
const container6 = document.createElement('div');
const input6 = document.createElement('input');
const icon = document.createElement('i');
icon.className = 'fas fa-lock';
const label_text6 = document.createElement('span');
label_text6.textContent = 'Password field';
container6.appendChild(icon);
container6.appendChild(input6);
container6.appendChild(label_text6);
document.body.appendChild(container6);
console.log('Test 6 (with icon, find text):', generateFallbackLabel(input6));
// Expected: "Password field"

console.log('\n=== All tests completed ===\n');
