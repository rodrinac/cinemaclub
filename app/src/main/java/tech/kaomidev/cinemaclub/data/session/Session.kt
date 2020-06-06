package tech.kaomidev.cinemaclub.data.session

import android.os.Parcelable
import kotlinx.android.parcel.IgnoredOnParcel
import kotlinx.android.parcel.Parcelize

@Parcelize
@Suppress("unused")
class Session : Parcelable {
    @IgnoredOnParcel
    var requestToken: String? = null
    @IgnoredOnParcel
    var sessionId: String? = null
}