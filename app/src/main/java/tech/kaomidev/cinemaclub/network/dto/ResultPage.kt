package tech.kaomidev.cinemaclub.network.dto

class ResultPage<T> {
    @Suppress("unused")
    var page: Long? = null
    var results: List<T>? = null
}

