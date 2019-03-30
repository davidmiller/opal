var filters = angular.module('opal.filters', []);

filters.filter('toMoment', function(){
		return function(input){
			if(!input){
				return;
			}
            if (_.isDate(input) ){
                return moment(input);
            }else{
				d = moment(input, 'DD/MM/YYYY HH:mm:ss');
			}

			return d;
		};
});

filters.filter('shortTime', function(hhmmFilter){
	return function(input){
	  var toChange;
		if(_.isDate(input)){
			toChange = moment(input);
		}
		else{
			toChange = moment(input, 'HH:mm:ss')
		}
		return hhmmFilter(toChange);
	};
});

filters.filter('displayDate', function(toMomentFilter, $injector){
  return function(input){
    if(!input){
      return
    };
    var DATE_DISPLAY_FORMAT = $injector.get('DATE_DISPLAY_FORMAT');
    m = toMomentFilter(input);
    return m.format(DATE_DISPLAY_FORMAT);
  }
})

filters.filter('displayDateTime', function(displayDateFilter, hhmmFilter){
  return function(input){
    if(!input){
      return
    };
    var datePart = displayDateFilter(input);
    var timePart = hhmmFilter(input);
    if (datePart && timePart) {
      return datePart + " " + timePart;
    }
  }
})

filters.filter('momentDateFormat', function(toMomentFilter){
	return function(input, format){
			if(!input){
					return;
			}
			var d = toMomentFilter(input);
			return d.format(format);
	};
});

filters.filter('hhmm', function(momentDateFormatFilter){
    return function(input, change){
				return momentDateFormatFilter(input, "H:mm")
    }
});

filters.filter('age', function(toMomentFilter){
    return function(input){
        if(!input){
            return null;
        }
        target = toMomentFilter(input)
        diff =  moment().diff(target, 'years')
        return diff
    }
});

filters.filter('upper', function(){
    return function(input){
        if(!input){ return null };
        return input.toUpperCase();
    }
});

filters.filter('title', function(){
	return function(s) {
        s = ( s === undefined || s === null ) ? '' : s;
        return s.toString().replace( /\b([a-zA-Z])/g, function(ch) {
            return ch.toUpperCase();
        });
    };
});

filters.filter('displayArray', function(){
	return function(rawArray, conjunction){
		if(!_.isArray(rawArray)){
			return rawArray;
		}
		var someArray = angular.copy(rawArray);
		if(!conjunction){
			conjunction = 'and';
		}
		if(someArray.length === 1){
			return someArray[0]
		}

		var lastWord = someArray.pop();
		var firstPart = someArray.join(", ")
		return firstPart + " " + conjunction + " " + lastWord;
	}
});

filters.filter('underscoreToSpaces', function(){
  return function(str){
		str = ( str === undefined || str === null ) ? '' : str;
    return str.toString().replace(/_/g, ' ');
  };
});

filters.filter('totalDays', function(toMomentFilter){
    return function(item){
        if(!item.start_date){ return null; }
        var start = toMomentFilter(item.start_date);

        if(item.end_date){
			end = toMomentFilter(item.end_date);
            return end.diff(start, 'days') + 1;
        }else{
            return moment().diff(start, 'days') + 1;
        }
    };
});
