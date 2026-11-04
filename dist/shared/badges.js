const symbols=Object.freeze({
 crown:'👑',star:'⭐',crystal:'◆',trophy:'🏆',paw:'🐾',
 moon:'🌙',leaf:'🍃',flame:'🔥',heart:'💜',shield:'🛡️'
});

export function badgeIcon(icon){
 return Object.hasOwn(symbols,icon)?symbols[icon]:'✦';
}

export function badgeLabel(value){
 return value.charAt(0).toUpperCase()+value.slice(1).toLowerCase();
}

export function badgeAvailable(badge) {
 return badge.available ?? badge.active;
}

export function badgeAvailabilityLabel(badge) {
 if (!badge.active) return 'retired';
 if (!badgeAvailable(badge)) return 'award window ended';
 return badge.endsOn ? 'available through ' + badge.endsOn + ' UTC' : 'available to award';
}
