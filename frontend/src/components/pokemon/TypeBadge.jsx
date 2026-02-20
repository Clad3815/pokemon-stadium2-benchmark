import React from 'react';
import { typeColors } from '../../constants/pokemonTypes';

const TypeBadge = ({ type, pokeApiCache }) => {
  
  // Normalize a type name (capitalize first letter, rest lowercase)
  const normalizeTypeName = (name) => {
    if (typeof name !== 'string') return 'Unknown';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };



  // Render a single type badge
  const renderTypeBadge = (typeName) => {
    const normalizedName = normalizeTypeName(typeName);
    return (
      <span 
        key={normalizedName} 
        className={`pokemon-type-badge type-badge-${normalizedName.toLowerCase()} text-white uppercase `}
      >
        {normalizedName}
      </span>
    );
  };

  // Handle unknown type
  if (type === undefined || type === null) {
    return renderTypeBadge('Unknown');
  }
  
  // Handle dual types with "/"
  if (typeof type === 'string' && type.includes("/")) {
    const types = type.split("/");
    return (
      <div className="flex gap-1">
        {types.map(t => renderTypeBadge(t))}
      </div>
    );
  }
  
  // Handle array of types
  if (Array.isArray(type)) {
    return (
      <div className="flex gap-1">
        {type.map((t, index) => (
          <React.Fragment key={index}>
            {renderTypeBadge(t)}
          </React.Fragment>
        ))}
      </div>
    );
  }
  
  // Handle single type
  return renderTypeBadge(type);
};

export default TypeBadge; 